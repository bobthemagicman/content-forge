"use client";

// The session API every page uses (T035): status, user, sign in/out, and the ID token for the asset
// session (T036). Two providers implement it: `AuthProvider` (Cognito via Amplify) and, for the beta
// preview, `DemoSessionProvider`. `Providers` picks one with DEMO_MODE.

import { createContext, useContext } from "react";

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
  /** The current Cognito ID token, refreshed if needed; undefined when signed out. */
  idToken: () => Promise<string | undefined>;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside a session provider");
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
