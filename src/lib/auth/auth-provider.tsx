"use client";

import { fetchAuthSession, signOut as amplifySignOut, signInWithRedirect } from "aws-amplify/auth";

/**
 * Google Workspace is a Cognito OIDC provider, so it's named, not the built-in `"Google"` (research
 * R3). Must match `GOOGLE_PROVIDER_NAME` in `amplify/config.ts`; tests/component/auth-provider.test.tsx
 * checks.
 */
export const GOOGLE_PROVIDER_NAME = "GoogleWorkspace";
import { Hub } from "aws-amplify/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSETS_BASE_URL } from "@/lib/config";
import { configureAmplify } from "./amplify-config";
import { type Session, SessionContext, type SessionUser } from "./session";

type SessionState = Pick<Session, "status" | "user">;

const SIGNED_OUT: SessionState = { status: "signedOut", user: null };

/**
 * The signed-in user, from the ID token's claims (Google's email, name, and picture, mapped by the
 * user pool's Google provider in infra/auth). Reading the token avoids `fetchUserAttributes()`,
 * which needs the `aws.cognito.signin.user.admin` scope the app client doesn't grant.
 */
async function currentUser(): Promise<SessionUser | null> {
  const claims = (await fetchAuthSession()).tokens?.idToken?.payload;
  if (!claims) return null;
  const email = typeof claims.email === "string" ? claims.email : "";
  const name = typeof claims.name === "string" && claims.name ? claims.name : email;
  const picture = typeof claims.picture === "string" ? claims.picture : undefined;
  return { email, name, picture };
}

/** Cognito session through Amplify (T035, research R11). Client gating is UX only (Principle II). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading", user: null });
  // Set while signOut() hands the page to Cognito's /logout (see signOut below).
  const signingOut = useRef(false);

  useEffect(() => {
    configureAmplify();
    let active = true;
    const load = () =>
      currentUser().then(
        (user) => active && setState(user ? { status: "signedIn", user } : SIGNED_OUT),
        // No usable session (for example, the refresh token expired): back to the landing page.
        () => active && setState(SIGNED_OUT),
      );

    void load();
    const stop = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
        case "tokenRefresh":
          void load();
          break;
        case "signedOut":
          if (!signingOut.current) setState(SIGNED_OUT);
          break;
        case "tokenRefresh_failure":
          setState(SIGNED_OUT);
          break;
      }
    });
    return () => {
      active = false;
      stop();
    };
  }, []);

  const signIn = useCallback(() => {
    configureAmplify();
    signInWithRedirect({ provider: { custom: GOOGLE_PROVIDER_NAME } }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "UserAlreadyAuthenticatedException") router.replace("/browse/");
      else router.replace("/?error=signin");
    });
  }, [router]);

  const signOut = useCallback(async () => {
    // Hold the session in "loading" (the signed-in layout shows its busy state) rather than letting
    // the signed-out redirect run: a client-side navigation started now can cancel the full-page one
    // to Cognito's /logout below (seen in WebKit), which would leave the hosted-UI session alive.
    signingOut.current = true;
    setState({ status: "loading", user: null });
    // Clears the asset cookies (contracts/assets-cdn.md). Best effort: they expire on their own, and
    // a failure here must not keep the user signed in.
    await fetch(`${ASSETS_BASE_URL}/_session/signout`, { credentials: "include" }).catch(() => undefined);
    try {
      // Every session here comes from the hosted UI, so this clears the tokens and sends the page
      // through Cognito's /logout, which returns to `/`.
      await amplifySignOut();
    } catch {
      // The local tokens are cleared before the redirect is attempted; fall back to the landing page.
      signingOut.current = false;
      setState(SIGNED_OUT);
    }
  }, []);

  const idToken = useCallback(async () => (await fetchAuthSession()).tokens?.idToken?.toString(), []);

  const value = useMemo<Session>(() => ({ ...state, signIn, signOut, idToken }), [state, signIn, signOut, idToken]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
