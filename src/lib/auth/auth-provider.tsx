"use client";

import { fetchAuthSession, signOut as amplifySignOut, signInWithRedirect } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { assetsBaseUrl, configureAmplify } from "./amplify-config";
import { type Session, SessionContext, type SessionUser } from "./session";

type SessionState = Pick<Session, "status" | "user">;

const SIGNED_OUT: SessionState = { status: "signedOut", user: null };

/**
 * The signed-in user, from the ID token's claims (Google's email, name, and picture, mapped by
 * `defineAuth`). Reading the token avoids `fetchUserAttributes()`, which needs the
 * `aws.cognito.signin.user.admin` scope the app client doesn't grant.
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
    signInWithRedirect({ provider: "Google" }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "UserAlreadyAuthenticatedException") router.replace("/browse/");
      else router.replace("/?error=signin");
    });
  }, [router]);

  const signOut = useCallback(async () => {
    const base = assetsBaseUrl();
    // Clears the asset cookies (contracts/assets-cdn.md). Best effort: they expire on their own, and
    // a failure here must not keep the user signed in.
    if (base) await fetch(`${base}/_session/signout`, { credentials: "include" }).catch(() => undefined);
    // With OAuth configured, this leaves through Cognito's /logout, which returns to `/`.
    await amplifySignOut();
    router.replace("/");
  }, [router]);

  const idToken = useCallback(async () => (await fetchAuthSession()).tokens?.idToken?.toString(), []);

  const value = useMemo<Session>(() => ({ ...state, signIn, signOut, idToken }), [state, signIn, signOut, idToken]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
