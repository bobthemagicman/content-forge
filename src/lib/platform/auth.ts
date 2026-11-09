// The browser's sign-in port (T134, specs/003-portable-deployment/plan.md "Ports"). `AuthProvider`
// and the callback page use only this; each provider supplies an adapter, picked by
// platform-config.json's `auth.kind`.

import { PLATFORM_CONFIG } from "@/lib/config";
import { createCognitoAuthClient } from "./aws/auth";

/** The signed-in user, from the ID token's claims. */
export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
}

/**
 * What the broker reports about the session. `signedIn` covers a completed redirect, `refreshed` a
 * renewed token, and `refreshFailed` a session that can't be renewed (the user must sign in again).
 */
export type AuthEvent = "signedIn" | "refreshed" | "signedOut" | "refreshFailed";

/** How a sign-in redirect ended, on the callback page. */
export type SignInResult = { ok: true } | { ok: false; message?: string };

/** `signIn()` rejects with this when a session already exists. */
export class AlreadySignedInError extends Error {
  constructor() {
    super("Already signed in");
    this.name = "AlreadySignedInError";
  }
}

export interface AuthClient {
  /** The user, or null when signed out. Rejects when the session can't be read. */
  currentUser(): Promise<AuthUser | null>;
  /** Sends the page to the broker's sign-in. Rejects if the redirect can't start. */
  signIn(): Promise<void>;
  /**
   * Clears the local session and sends the page through the broker's sign-out, which returns to `/`.
   * Rejects if that redirect can't start; the local session is gone either way.
   */
  signOut(): Promise<void>;
  /** The current ID token, refreshed if needed; undefined when signed out. */
  idToken(): Promise<string | undefined>;
  /** The current access token, refreshed if needed; undefined when signed out. */
  accessToken(): Promise<string | undefined>;
  /** Calls `listener` on every session change; returns the unsubscribe function. */
  onChange(listener: (event: AuthEvent) => void): () => void;
  /**
   * Finishes the sign-in redirect on the callback page, calling `onResult` once with the outcome.
   * Call it before anything else reads the session, so the adapter is listening before the code
   * exchange starts. Returns a function that stops waiting.
   */
  completeSignIn(onResult: (result: SignInResult) => void): () => void;
}

let client: AuthClient | undefined;

/** This deployment's adapter, created on first use. */
export function authClient(): AuthClient {
  // One provider so far. A second adds a case here, ideally behind a dynamic import so each build
  // ships only its own SDK.
  client ??= createCognitoAuthClient(PLATFORM_CONFIG);
  return client;
}
