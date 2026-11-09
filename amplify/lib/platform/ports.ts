// The server-side ports (T136, specs/003-portable-deployment/plan.md "Ports"): every call the
// backend's functions make to a cloud service goes through one of these. AWS adapters live in
// ./aws/; adapters that only need a standard (OIDC's JWKS) live here. Each port has a contract suite
// in tests/unit/platform/server/contracts/ that every adapter must pass.

// --- TokenVerifier --------------------------------------------------------------------------------

/** A verified token's claims, as the issuer wrote them. */
export type Claims = Readonly<Record<string, unknown>>;

export interface TokenVerifier {
  /**
   * Checks the signature against the issuer's published keys, then the issuer, audience, token
   * use and expiry. Resolves to the claims; rejects with `InvalidTokenError` for a token the caller
   * should refuse, or `KeyFetchError` when the issuer's keys can't be loaded (an outage, not a bad
   * token).
   */
  verify(token: string): Promise<Claims>;
}

export class InvalidTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InvalidTokenError";
  }
}

export class KeyFetchError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Could not load the issuer's signing keys", options);
    this.name = "KeyFetchError";
  }
}

// --- SettingsStore --------------------------------------------------------------------------------

export interface SettingsStore {
  /**
   * The value of a deployment setting (docs/deployment/settings.md). `secret` settings are stored
   * encrypted and decrypted on read. Rejects with `SettingNotFoundError` when the setting is missing
   * or empty, and with the store's own error when it can't be reached.
   */
  get(name: string, options?: { secret?: boolean }): Promise<string>;
}

export class SettingNotFoundError extends Error {
  constructor(readonly setting: string) {
    super(`Setting ${setting} is missing or empty`);
    this.name = "SettingNotFoundError";
  }
}

// --- CatalogStore ---------------------------------------------------------------------------------

/**
 * A catalog item as stored (data-model.md "Entity: Content"). Only the fields the functions read so
 * far; ingest (T137) and downloads (US3) add theirs.
 */
export interface CatalogRecord {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  demoEntryPath?: string;
}

export interface CatalogStore {
  /**
   * The item with this id, reading only `fields` (plus `id`), or undefined when there's none.
   * Drafts are returned too: callers decide what a draft means for them.
   */
  get<K extends keyof CatalogRecord>(id: string, fields: readonly K[]): Promise<Pick<CatalogRecord, K | "id"> | undefined>;
}

// --- AssetSigner ----------------------------------------------------------------------------------

export interface AssetSigner {
  /** The cookie names `sessionCookies` sets, so sign-out can clear them without signing. */
  readonly cookieNames: readonly string[];
  /** Cookie values granting every viewable asset (`/v/*` on the asset host) until `expiresAt`. */
  sessionCookies(expiresAt: Date): Promise<Record<string, string>>;
  /**
   * A launch link for one demo on the demo host, valid until `expiresAt` and only for that demo's
   * files. `entryPath` is already URL-encoded, segment by segment.
   */
  demoLaunchUrl(id: string, entryPath: string, expiresAt: Date): Promise<string>;
  /**
   * A download URL for one archive, valid until `expiresAt`. `key` is the stored `archiveKey`,
   * `a/<id>/<file name>` (data-model.md); any other key is refused.
   */
  downloadUrl(key: string, expiresAt: Date): Promise<string>;
}
