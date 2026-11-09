import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, GOOGLE_PROVIDER_NAME } from "@/lib/auth/auth-provider";
import { type Session, useSession } from "@/lib/auth/session";

type HubCallback = (data: { payload: { event: string } }) => void;

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const amplify = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
  hub: [] as HubCallback[],
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: amplify.fetchAuthSession,
  signInWithRedirect: amplify.signInWithRedirect,
  signOut: amplify.signOut,
}));
vi.mock("aws-amplify/utils", () => ({
  Hub: {
    listen: (_channel: string, callback: HubCallback) => {
      amplify.hub.push(callback);
      return () => amplify.hub.splice(amplify.hub.indexOf(callback), 1);
    },
  },
}));
vi.mock("@/lib/auth/amplify-config", () => ({ configureAmplify: vi.fn() }));
vi.mock("@/lib/config", () => ({ ASSETS_BASE_URL: "https://assets.example.com", DEMO_MODE: false }));

function tokens(claims: Record<string, unknown>) {
  return { tokens: { idToken: { payload: claims, toString: () => "id-token-jwt" } } };
}

const latest: { current?: Session } = {};
function Probe() {
  const session = useSession();
  useEffect(() => {
    latest.current = session;
  });
  return (
    <p data-testid="probe">
      {session.status} {session.user ? `${session.user.name} <${session.user.email}> ${session.user.picture ?? ""}` : ""}
    </p>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    amplify.hub.length = 0;
    // Sign-out always calls the asset plane; no test may reach the network.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    amplify.fetchAuthSession.mockResolvedValue({ tokens: undefined });
    amplify.signInWithRedirect.mockResolvedValue(undefined);
    amplify.signOut.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts loading, then reports signed out without tokens", async () => {
    renderProvider();
    expect(screen.getByTestId("probe")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("signedOut"));
  });

  it("reads the user from the ID token", async () => {
    amplify.fetchAuthSession.mockResolvedValue(
      tokens({ email: "ada@example.com", name: "Ada Lovelace", picture: "https://lh3.googleusercontent.com/a" }),
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent(
        "signedIn Ada Lovelace <ada@example.com> https://lh3.googleusercontent.com/a",
      ),
    );
    await expect(latest.current!.idToken()).resolves.toBe("id-token-jwt");
  });

  it("falls back to the email when the token has no name", async () => {
    amplify.fetchAuthSession.mockResolvedValue(tokens({ email: "ada@example.com" }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("signedIn ada@example.com <ada@example.com>"));
  });

  it("treats a session error as signed out", async () => {
    amplify.fetchAuthSession.mockRejectedValue(new Error("network"));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("signedOut"));
  });

  it("follows Hub sign-in and sign-out events", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("signedOut"));

    amplify.fetchAuthSession.mockResolvedValue(tokens({ email: "ada@example.com", name: "Ada" }));
    act(() => amplify.hub.forEach((cb) => cb({ payload: { event: "signInWithRedirect" } })));
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("signedIn Ada"));

    act(() => amplify.hub.forEach((cb) => cb({ payload: { event: "tokenRefresh_failure" } })));
    expect(screen.getByTestId("probe")).toHaveTextContent("signedOut");
  });

  it("signs in through the Google Workspace OIDC provider the backend defines", async () => {
    const backend = await import("../../amplify/config");
    expect(GOOGLE_PROVIDER_NAME).toBe(backend.GOOGLE_PROVIDER_NAME);
    renderProvider();
    act(() => latest.current!.signIn());
    expect(amplify.signInWithRedirect).toHaveBeenCalledWith({ provider: { custom: GOOGLE_PROVIDER_NAME } });
  });

  it("returns to the landing error when the redirect can't start", async () => {
    amplify.signInWithRedirect.mockRejectedValue(new Error("boom"));
    renderProvider();
    act(() => latest.current!.signIn());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/?error=signin"));
  });

  it("clears the asset cookies, then signs out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderProvider();

    await act(async () => latest.current!.signOut());
    expect(fetchMock).toHaveBeenCalledWith("https://assets.example.com/_session/signout", { credentials: "include" });
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(amplify.signOut.mock.invocationCallOrder[0]!);
  });

  it("leaves navigation to Cognito's logout redirect", async () => {
    amplify.fetchAuthSession.mockResolvedValue(tokens({ email: "ada@example.com", name: "Ada" }));
    // Amplify dispatches signedOut, then sends the page to /logout.
    amplify.signOut.mockImplementation(async () => amplify.hub.forEach((cb) => cb({ payload: { event: "signedOut" } })));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("signedIn"));

    await act(async () => latest.current!.signOut());
    // Still "loading", so the signed-in layout doesn't start a client-side redirect to /.
    expect(screen.getByTestId("probe")).toHaveTextContent("loading");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("falls back to signed out when sign-out fails", async () => {
    amplify.signOut.mockRejectedValue(new Error("invalid origin"));
    renderProvider();

    await act(async () => latest.current!.signOut());
    expect(screen.getByTestId("probe")).toHaveTextContent("signedOut");
  });

  it("still signs out when clearing the asset cookies fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    renderProvider();

    await act(async () => latest.current!.signOut());
    expect(amplify.signOut).toHaveBeenCalledOnce();
  });
});
