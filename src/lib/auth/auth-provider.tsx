"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSETS_BASE_URL } from "@/lib/config";
import { AlreadySignedInError, authClient } from "@/lib/platform/auth";
import { type Session, SessionContext } from "./session";

type SessionState = Pick<Session, "status" | "user">;

const SIGNED_OUT: SessionState = { status: "signedOut", user: null };

/**
 * The real session, through the deployment's `AuthClient` (T035, T134; research R11). Client gating
 * is UX only (Principle II).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading", user: null });
  // Set while signOut() hands the page to the broker's sign-out (see signOut below).
  const signingOut = useRef(false);

  useEffect(() => {
    const auth = authClient();
    let active = true;
    const load = () =>
      auth.currentUser().then(
        (user) => active && setState(user ? { status: "signedIn", user } : SIGNED_OUT),
        // No usable session (for example, the refresh token expired): back to the landing page.
        () => active && setState(SIGNED_OUT),
      );

    void load();
    const stop = auth.onChange((event) => {
      switch (event) {
        case "signedIn":
        case "refreshed":
          void load();
          break;
        case "signedOut":
          if (!signingOut.current) setState(SIGNED_OUT);
          break;
        case "refreshFailed":
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
    authClient()
      .signIn()
      .catch((error: unknown) => {
        if (error instanceof AlreadySignedInError) router.replace("/browse/");
        else router.replace("/?error=signin");
      });
  }, [router]);

  const signOut = useCallback(async () => {
    // Hold the session in "loading" (the signed-in layout shows its busy state) rather than letting
    // the signed-out redirect run: a client-side navigation started now can cancel the full-page one
    // to the broker's sign-out below (seen in WebKit), which would leave its session alive.
    signingOut.current = true;
    setState({ status: "loading", user: null });
    // Clears the asset cookies (contracts/assets-cdn.md). Best effort: they expire on their own, and
    // a failure here must not keep the user signed in.
    await fetch(`${ASSETS_BASE_URL}/_session/signout`, { credentials: "include" }).catch(() => undefined);
    try {
      await authClient().signOut();
    } catch {
      // The local tokens are cleared before the redirect is attempted; fall back to the landing page.
      signingOut.current = false;
      setState(SIGNED_OUT);
    }
  }, []);

  const idToken = useCallback(() => authClient().idToken(), []);

  const value = useMemo<Session>(() => ({ ...state, signIn, signOut, idToken }), [state, signIn, signOut, idToken]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
