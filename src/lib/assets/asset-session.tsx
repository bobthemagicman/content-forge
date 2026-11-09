"use client";

// The asset session (T036, contracts/assets-cdn.md "Client obligations"). Viewable assets are
// behind CloudFront signed cookies, which `/_session` sets in exchange for the Cognito ID token. The
// signed-in layout renders nothing from the catalog until the first exchange succeeds, keeps the
// cookies fresh, and asks the user to sign in again when they can't be renewed (FR-029).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FullPageLoading } from "@/components/full-page-loading";
import { Banner } from "@/components/ui/banner";
import { useSession } from "@/lib/auth/session";
import { ASSETS_BASE_URL, DEMO_MODE } from "@/lib/config";

/** How often to check the cookies' expiry, besides on window focus. */
export const CHECK_INTERVAL_MS = 15 * 60_000;
/** Renew when the cookies have less than this left. */
export const RENEW_BEFORE_MS = 60 * 60_000;
/** At most one renewal per this long because of asset errors, so a row of broken images can't flood `/_session`. */
export const ERROR_RENEWAL_GAP_MS = 60_000;

type Exchange = "ok" | "unauthorized" | "failed";
type Status = "loading" | "ready" | "failed" | "needsSignIn";

interface AssetSession {
  /** True once the cookies can't be renewed: the layout shows `AssetSessionBanner`. */
  needsSignIn: boolean;
  /**
   * Call when a catalog asset fails to load. It renews the cookies, at most once a minute, and sets
   * `needsSignIn` only if that renewal fails. An asset that fails with fresh cookies is that asset's
   * problem (a 404, say), not the session's.
   */
  reportAssetError: () => void;
  /** Ends the session and goes back to the landing page, where the user signs in again. */
  signInAgain: () => void;
}

const AssetSessionContext = createContext<AssetSession | null>(null);

export function useAssetSession(): AssetSession {
  const session = useContext(AssetSessionContext);
  if (!session) throw new Error("useAssetSession must be used inside AssetSessionProvider");
  return session;
}

/** The demo catalog's assets are public files on the site itself, so the beta preview has no session. */
const DEMO_SESSION: AssetSession = { needsSignIn: false, reportAssetError: () => {}, signInAgain: () => {} };

export function AssetSessionProvider({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) return <AssetSessionContext.Provider value={DEMO_SESSION}>{children}</AssetSessionContext.Provider>;
  return <CookieSessionProvider>{children}</CookieSessionProvider>;
}

function CookieSessionProvider({ children }: { children: React.ReactNode }) {
  const { idToken, signOut } = useSession();
  const [status, setStatus] = useState<Status>("loading");
  const expiresAt = useRef(0);
  // When reportAssetError last renewed the cookies.
  const lastErrorRenewal = useRef(Number.NEGATIVE_INFINITY);
  const inFlight = useRef<Promise<Exchange> | null>(null);

  /** One `/_session` exchange; concurrent callers share it. A `401` signs the user out. */
  const exchange = useCallback((): Promise<Exchange> => {
    inFlight.current ??= (async (): Promise<Exchange> => {
      const token = await idToken().catch(() => undefined);
      if (!token) return "unauthorized";
      try {
        const response = await fetch(`${ASSETS_BASE_URL}/_session`, {
          credentials: "include",
          headers: { "X-Id-Token": token },
        });
        if (response.status === 401) return "unauthorized";
        if (response.status !== 204) return "failed";
        // Without the header, assume the cookies are close to expiring, so the next check renews them.
        const expires = Date.parse(response.headers.get("X-Session-Expires") ?? "");
        expiresAt.current = Number.isFinite(expires) ? expires : Date.now() + RENEW_BEFORE_MS - 1;
        return "ok";
      } catch {
        return "failed";
      }
    })()
      .then((result) => {
        if (result === "unauthorized") signOut();
        return result;
      })
      .finally(() => {
        inFlight.current = null;
      });
    return inFlight.current;
  }, [idToken, signOut]);

  const start = useCallback(async () => {
    const result = await exchange();
    // On "unauthorized", stay on the loading screen while sign-out takes the page away.
    if (result !== "unauthorized") setStatus(result === "ok" ? "ready" : "failed");
  }, [exchange]);

  useEffect(() => {
    void start();
  }, [start]);

  const retry = () => {
    setStatus("loading");
    void start();
  };

  // Renew ahead of expiry, checked every 15 minutes and whenever the window regains focus.
  useEffect(() => {
    if (status !== "ready") return;
    const check = () => {
      if (inFlight.current || expiresAt.current - Date.now() >= RENEW_BEFORE_MS) return;
      void exchange().then((result) => {
        if (result === "failed" && Date.now() >= expiresAt.current) setStatus("needsSignIn");
      });
    };
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [status, exchange]);

  const reportAssetError = useCallback(() => {
    // Errors while a renewal is running, or just after one, are the same failure; it decides.
    if (inFlight.current || Date.now() - lastErrorRenewal.current < ERROR_RENEWAL_GAP_MS) return;
    lastErrorRenewal.current = Date.now();
    void exchange().then((result) => {
      if (result === "failed") setStatus("needsSignIn");
    });
  }, [exchange]);

  const value = useMemo<AssetSession>(
    () => ({ needsSignIn: status === "needsSignIn", reportAssetError, signInAgain: signOut }),
    [status, reportAssetError, signOut],
  );

  if (status === "loading") return <FullPageLoading />;
  if (status === "failed") {
    return (
      <div className="container-page py-16">
        <Banner title="We couldn’t load the library." onRetry={retry}>
          Check your connection and try again.
        </Banner>
      </div>
    );
  }
  return <AssetSessionContext.Provider value={value}>{children}</AssetSessionContext.Provider>;
}

/** "Session expired" with a way back in (FR-029). Renders nothing while the session is fine. */
export function AssetSessionBanner() {
  const { needsSignIn, signInAgain } = useAssetSession();
  if (!needsSignIn) return null;
  return (
    <div className="container-page pt-4">
      <Banner title="Your session expired." onRetry={signInAgain} retryLabel="Sign in again">
        Previews and downloads need a fresh sign-in.
      </Banner>
    </div>
  );
}
