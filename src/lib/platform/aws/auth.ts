// Cognito, through Amplify Auth: the AWS adapter for the AuthClient port (T134, research R11).

// Completes the OAuth redirect on the callback page, whichever modules it imports.
import "aws-amplify/auth/enable-oauth-listener";
import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import type { AuthClient, AuthEvent, AuthUser, SignInResult } from "@/lib/platform/auth";
import { AlreadySignedInError } from "@/lib/platform/auth";
import type { PlatformConfig } from "@/lib/platform/config";
import { configureAmplify } from "./amplify";

/**
 * Google Workspace is a Cognito OIDC provider, so it's named, not the built-in `"Google"` (research
 * R3). Must match `GOOGLE_PROVIDER_NAME` in `amplify/config.ts`; tests/component/auth-provider.test.tsx
 * checks.
 */
export const GOOGLE_PROVIDER_NAME = "GoogleWorkspace";

const EVENTS: Record<string, AuthEvent | undefined> = {
  signedIn: "signedIn",
  signInWithRedirect: "signedIn",
  tokenRefresh: "refreshed",
  signedOut: "signedOut",
  tokenRefresh_failure: "refreshFailed",
};

export function createCognitoAuthClient(config: PlatformConfig): AuthClient {
  const ready = () => configureAmplify(config);
  const tokens = async () => {
    ready();
    return (await fetchAuthSession()).tokens;
  };

  return {
    /**
     * From the ID token's claims (Google's email, name, and picture, mapped by the user pool's Google
     * provider in infra/auth). Reading the token avoids `fetchUserAttributes()`, which needs the
     * `aws.cognito.signin.user.admin` scope the app client doesn't grant.
     */
    async currentUser(): Promise<AuthUser | null> {
      const claims = (await tokens())?.idToken?.payload;
      if (!claims) return null;
      const email = typeof claims.email === "string" ? claims.email : "";
      const name = typeof claims.name === "string" && claims.name ? claims.name : email;
      const picture = typeof claims.picture === "string" ? claims.picture : undefined;
      return { email, name, picture };
    },

    async signIn() {
      ready();
      try {
        await signInWithRedirect({ provider: { custom: GOOGLE_PROVIDER_NAME } });
      } catch (error) {
        if (error instanceof Error && error.name === "UserAlreadyAuthenticatedException") throw new AlreadySignedInError();
        throw error;
      }
    },

    // Every session here comes from the hosted UI, so this clears the tokens and sends the page
    // through Cognito's /logout, which returns to `/`.
    async signOut() {
      ready();
      await signOut();
    },

    idToken: async () => (await tokens())?.idToken?.toString(),
    accessToken: async () => (await tokens())?.accessToken?.toString(),

    onChange(listener) {
      return Hub.listen("auth", ({ payload }) => {
        const event = EVENTS[payload.event];
        if (event) listener(event);
      });
    },

    completeSignIn(onResult) {
      let settled = false;
      const finish = (result: SignInResult) => {
        if (settled) return;
        settled = true;
        stop();
        onResult(result);
      };
      // Listen before configuring: configuring is what starts the code exchange.
      const stop = Hub.listen("auth", ({ payload }) => {
        if (payload.event === "signInWithRedirect") finish({ ok: true });
        else if (payload.event === "signInWithRedirect_failure") finish({ ok: false, message: payload.data?.error?.message });
      });
      ready();
      // fetchAuthSession() waits for an in-flight redirect, so it settles the outcome even if the Hub
      // event fired first.
      fetchAuthSession().then(
        ({ tokens }) => finish(tokens ? { ok: true } : { ok: false }),
        () => finish({ ok: false }),
      );
      return () => {
        if (settled) return;
        settled = true;
        stop();
      };
    },
  };
}
