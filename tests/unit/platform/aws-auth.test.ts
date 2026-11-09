import { beforeEach, describe, expect, it, vi } from "vitest";
import twin from "../../e2e/fixtures/platform-config.e2e.json";
import { AlreadySignedInError } from "@/lib/platform/auth";
import { createCognitoAuthClient } from "@/lib/platform/aws/auth";
import { parsePlatformConfig } from "@/lib/platform/config";

type HubCallback = (data: { payload: { event: string } }) => void;

const amplify = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  hub: [] as HubCallback[],
}));
vi.mock("aws-amplify/auth/enable-oauth-listener", () => ({}));
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: amplify.fetchAuthSession,
  signInWithRedirect: amplify.signInWithRedirect,
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({
  Hub: {
    listen: (_channel: string, callback: HubCallback) => {
      amplify.hub.push(callback);
      return () => amplify.hub.splice(amplify.hub.indexOf(callback), 1);
    },
  },
}));
vi.mock("@/lib/platform/aws/amplify", () => ({ configureAmplify: vi.fn() }));

const auth = createCognitoAuthClient(parsePlatformConfig(twin));
const emit = (event: string) => [...amplify.hub].forEach((cb) => cb({ payload: { event } }));

describe("Cognito AuthClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    amplify.hub.length = 0;
  });

  it("returns both tokens as strings, or undefined when signed out", async () => {
    amplify.fetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => "id.jwt" }, accessToken: { toString: () => "access.jwt" } },
    });
    await expect(auth.idToken()).resolves.toBe("id.jwt");
    await expect(auth.accessToken()).resolves.toBe("access.jwt");

    amplify.fetchAuthSession.mockResolvedValue({ tokens: undefined });
    await expect(auth.accessToken()).resolves.toBeUndefined();
  });

  it("maps Amplify's Hub events to session events and ignores the rest", () => {
    const events: string[] = [];
    const stop = auth.onChange((event) => events.push(event));
    ["signInWithRedirect", "tokenRefresh", "customOAuthState", "tokenRefresh_failure", "signedOut"].forEach(emit);
    stop();
    emit("signedIn");
    expect(events).toEqual(["signedIn", "refreshed", "refreshFailed", "signedOut"]);
  });

  it("reports an existing session as AlreadySignedInError", async () => {
    amplify.signInWithRedirect.mockRejectedValue(Object.assign(new Error("signed in"), { name: "UserAlreadyAuthenticatedException" }));
    await expect(auth.signIn()).rejects.toBeInstanceOf(AlreadySignedInError);
  });

  it("reports the sign-in outcome once, then stops listening", () => {
    amplify.fetchAuthSession.mockReturnValue(new Promise(() => {}));
    const onResult = vi.fn();
    auth.completeSignIn(onResult);
    emit("signInWithRedirect");
    emit("signInWithRedirect_failure");
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ ok: true });
    expect(amplify.hub).toHaveLength(0);
  });

  it("stops listening when cancelled", async () => {
    let settle: (value: unknown) => void = () => {};
    amplify.fetchAuthSession.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const onResult = vi.fn();
    const cancel = auth.completeSignIn(onResult);
    cancel();
    expect(amplify.hub).toHaveLength(0);
    settle({ tokens: undefined });
    await Promise.resolve();
    expect(onResult).not.toHaveBeenCalled();
  });
});
