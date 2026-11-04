import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCallback } from "@/components/auth/auth-callback";

type HubCallback = (data: { payload: { event: string; data?: { error?: Error } } }) => void;

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const amplify = vi.hoisted(() => ({ fetchAuthSession: vi.fn(), hub: [] as HubCallback[] }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("aws-amplify/auth/enable-oauth-listener", () => ({}));
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: amplify.fetchAuthSession }));
vi.mock("aws-amplify/utils", () => ({
  Hub: {
    listen: (_channel: string, callback: HubCallback) => {
      amplify.hub.push(callback);
      return () => amplify.hub.splice(amplify.hub.indexOf(callback), 1);
    },
  },
}));
vi.mock("@/lib/auth/amplify-config", () => ({ configureAmplify: vi.fn() }));

const visit = (url: string) => window.history.replaceState({}, "", url);

describe("AuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    amplify.hub.length = 0;
    amplify.fetchAuthSession.mockReturnValue(new Promise(() => {}));
    visit("/auth/callback/?code=abc&state=xyz");
  });

  it("shows a busy state while it waits", () => {
    render(<AuthCallback />);
    expect(screen.getByRole("status")).toHaveTextContent("Signing you in…");
  });

  it("goes to browse once the session exists", async () => {
    amplify.fetchAuthSession.mockResolvedValue({ tokens: { idToken: {} } });
    render(<AuthCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/browse/"));
  });

  it("maps a pre-sign-up rejection in the URL to the domain error", () => {
    visit("/auth/callback/?error_description=PreSignUp+failed+with+error+ONLY_ALLOWED_DOMAIN.+&error=invalid_request");
    render(<AuthCallback />);
    expect(router.replace).toHaveBeenCalledWith("/?error=domain");
    expect(amplify.fetchAuthSession).not.toHaveBeenCalled();
  });

  it("maps any other URL error to the sign-in error", () => {
    visit("/auth/callback/?error=access_denied");
    render(<AuthCallback />);
    expect(router.replace).toHaveBeenCalledWith("/?error=signin");
  });

  it("maps a Hub failure to the landing error", () => {
    render(<AuthCallback />);
    act(() =>
      amplify.hub.forEach((cb) =>
        cb({ payload: { event: "signInWithRedirect_failure", data: { error: new Error("invalid_grant") } } }),
      ),
    );
    expect(router.replace).toHaveBeenCalledWith("/?error=signin");
  });

  it("falls back to the sign-in error when no session results", async () => {
    amplify.fetchAuthSession.mockResolvedValue({ tokens: undefined });
    render(<AuthCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/?error=signin"));
  });

  it("navigates only once when Hub and the session both report", async () => {
    amplify.fetchAuthSession.mockResolvedValue({ tokens: { idToken: {} } });
    render(<AuthCallback />);
    act(() => amplify.hub.forEach((cb) => cb({ payload: { event: "signInWithRedirect" } })));
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(router.replace).toHaveBeenCalledWith("/browse/");
  });
});
