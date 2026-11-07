"use client";

// Beta preview stand-in for `AuthProvider`: sign-in is simulated with a flag in localStorage. T128
// deletes it once the backend is live.

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { type Session, SessionContext, type SessionUser } from "./session";

const STORAGE_KEY = "content-forge:beta-session";
const DEMO_USER: SessionUser = { email: "viewer@example.com", name: "Beta Viewer" };

// The stored flag is an external store: read on the client, absent during prerender ("loading"),
// and kept in sync across tabs through the storage event.
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
function setStored(signedIn: boolean) {
  if (signedIn) localStorage.setItem(STORAGE_KEY, "1");
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l());
}
const getSnapshot = (): Session["status"] => (localStorage.getItem(STORAGE_KEY) ? "signedIn" : "signedOut");
const getServerSnapshot = (): Session["status"] => "loading";
const noIdToken = async () => undefined;

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback(() => {
    setStored(true);
    router.replace("/browse/");
  }, [router]);

  const signOut = useCallback(() => {
    setStored(false);
    router.replace("/");
  }, [router]);

  const value = useMemo<Session>(
    () => ({ status, user: status === "signedIn" ? DEMO_USER : null, signIn, signOut, idToken: noIdToken }),
    [status, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
