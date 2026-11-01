"use client";

// Session context with the shape AuthProvider will expose (T035): status, user, signOut. The beta
// preview simulates sign-in with a flag in localStorage; T035 replaces this with Cognito via
// Amplify, keeping the same `useSession()` API.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export interface SessionUser {
  email: string;
  name: string;
  picture?: string;
}

export interface Session {
  status: "loading" | "signedIn" | "signedOut";
  user: SessionUser | null;
  signIn: () => void;
  signOut: () => void;
}

const STORAGE_KEY = "content-forge:beta-session";
const DEMO_USER: SessionUser = { email: "viewer@example.com", name: "Beta Viewer" };

const SessionContext = createContext<Session | null>(null);

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

export function SessionProvider({ children }: { children: React.ReactNode }) {
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
    () => ({ status, user: status === "signedIn" ? DEMO_USER : null, signIn, signOut }),
    [status, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
