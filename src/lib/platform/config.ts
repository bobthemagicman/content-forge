// platform-config.json: what the web build needs to know about its deployment, in a shape no cloud
// provider owns (specs/003-portable-deployment/contracts/platform-config.md, T132). Each provider's
// deploy writes it; on AWS, scripts/platform/aws-outputs-to-config.mjs converts amplify_outputs.json.
// Everything in it ends up in the public bundle, so it never holds a secret.

export const PROVIDERS = ["aws"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** A Cognito user pool's hosted UI, signing in through its federated Google provider. */
export interface CognitoAuthConfig {
  kind: "cognito";
  /** `https://cognito-idp.<region>.amazonaws.com/<user pool id>` */
  issuer: string;
  clientId: string;
  /** The hosted UI's host name, without a scheme. */
  domain: string;
  scopes: string[];
  /** Where the broker may send the browser after sign-in; the app uses the one on its own origin. */
  signInRedirects: string[];
  /** Likewise after sign-out. */
  signOutRedirects: string[];
}

export type AuthConfig = CognitoAuthConfig;

/** AppSync's GraphQL endpoint, called with the user's access token (OIDC mode). */
export interface AppSyncCatalogConfig {
  kind: "appsync";
  url: string;
  region: string;
}

export type CatalogConfig = AppSyncCatalogConfig;

export interface PlatformConfig {
  provider: Provider;
  auth: AuthConfig;
  catalog: CatalogConfig;
  assets: {
    /** The asset host's origin, with no path or trailing slash (contracts/assets-cdn.md). */
    baseUrl: string;
  };
}

export class PlatformConfigError extends Error {
  constructor(problems: string[]) {
    super(`platform-config.json is invalid:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "PlatformConfigError";
  }
}

const COGNITO_ISSUER = /^https:\/\/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com\/([a-z0-9-]+_[A-Za-z0-9]+)$/;
const HOST_NAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;
const REGION = /^[a-z]{2}(?:-[a-z]+)+-\d$/;

/** The parts of a Cognito issuer the AWS adapter needs. */
export function parseCognitoIssuer(issuer: string): { region: string; userPoolId: string } {
  const match = COGNITO_ISSUER.exec(issuer);
  if (!match) throw new PlatformConfigError([`auth.issuer: not a Cognito user pool issuer: ${issuer}`]);
  return { region: match[1]!, userPoolId: match[2]! };
}

/**
 * Checks `value` against the contract and returns it typed. Every problem is reported at once, so a
 * deploy that writes a bad file can be fixed in one pass. Unknown fields are ignored, so a newer
 * deploy can add one before the app reads it.
 */
export function parsePlatformConfig(value: unknown): PlatformConfig {
  const problems: string[] = [];
  const root = asObject(value, "(root)", problems);
  if (!root) throw new PlatformConfigError(problems);

  const provider = oneOf(root.provider, "provider", PROVIDERS, problems);
  const auth = parseAuth(root.auth, problems);
  const catalog = parseCatalog(root.catalog, problems);
  const assetsObject = asObject(root.assets, "assets", problems);
  const baseUrl = assetsObject ? origin(assetsObject.baseUrl, "assets.baseUrl", problems) : undefined;

  if (problems.length || !provider || !auth || !catalog || !baseUrl) throw new PlatformConfigError(problems);
  return { provider, auth, catalog, assets: { baseUrl } };
}

function parseAuth(value: unknown, problems: string[]): AuthConfig | undefined {
  const auth = asObject(value, "auth", problems);
  if (!auth) return undefined;
  const kind = oneOf(auth.kind, "auth.kind", ["cognito"] as const, problems);
  if (!kind) return undefined;

  const issuer = url(auth.issuer, "auth.issuer", problems);
  if (issuer && !COGNITO_ISSUER.test(issuer)) problems.push(`auth.issuer: not a Cognito user pool issuer: ${issuer}`);
  const clientId = text(auth.clientId, "auth.clientId", problems);
  const domain = text(auth.domain, "auth.domain", problems);
  if (domain && !HOST_NAME.test(domain)) problems.push(`auth.domain: must be a host name without a scheme: ${domain}`);
  const scopes = list(auth.scopes, "auth.scopes", problems, (s, path) => text(s, path, problems));
  if (scopes && !scopes.includes("openid")) problems.push(`auth.scopes: must include "openid"`);
  const signInRedirects = list(auth.signInRedirects, "auth.signInRedirects", problems, (u, path) => url(u, path, problems));
  const signOutRedirects = list(auth.signOutRedirects, "auth.signOutRedirects", problems, (u, path) => url(u, path, problems));

  if (!issuer || !clientId || !domain || !scopes || !signInRedirects || !signOutRedirects) return undefined;
  return { kind, issuer, clientId, domain, scopes, signInRedirects, signOutRedirects };
}

function parseCatalog(value: unknown, problems: string[]): CatalogConfig | undefined {
  const catalog = asObject(value, "catalog", problems);
  if (!catalog) return undefined;
  const kind = oneOf(catalog.kind, "catalog.kind", ["appsync"] as const, problems);
  if (!kind) return undefined;

  const endpoint = url(catalog.url, "catalog.url", problems);
  const region = text(catalog.region, "catalog.region", problems);
  if (region && !REGION.test(region)) problems.push(`catalog.region: not an AWS region: ${region}`);
  if (!endpoint || !region) return undefined;
  return { kind, url: endpoint, region };
}

// --- Field checks: each returns the value, or undefined after recording a problem ---------------

function asObject(value: unknown, path: string, problems: string[]): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  problems.push(`${path}: missing, or not an object`);
  return undefined;
}

function text(value: unknown, path: string, problems: string[]): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value;
  problems.push(`${path}: missing, or not a non-empty string`);
  return undefined;
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[], problems: string[]): T | undefined {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  problems.push(`${path}: ${JSON.stringify(value)} is not one of ${allowed.map((a) => `"${a}"`).join(", ")}`);
  return undefined;
}

function list<T>(
  value: unknown,
  path: string,
  problems: string[],
  item: (value: unknown, path: string) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${path}: missing, or not a non-empty array`);
    return undefined;
  }
  const items = value.map((v, i) => item(v, `${path}[${i}]`));
  return items.every((i) => i !== undefined) ? (items as T[]) : undefined;
}

/** HTTPS, or plain HTTP on localhost for local development and tests. */
function url(value: unknown, path: string, problems: string[]): string | undefined {
  const raw = text(value, path, problems);
  if (!raw) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    problems.push(`${path}: not a URL: ${raw}`);
    return undefined;
  }
  const local = parsed.protocol === "http:" && parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !local) {
    problems.push(`${path}: must be https (or http://localhost): ${raw}`);
    return undefined;
  }
  return raw;
}

/** A URL with no path, query or fragment, returned without a trailing slash. */
function origin(value: unknown, path: string, problems: string[]): string | undefined {
  const raw = url(value, path, problems);
  if (!raw) return undefined;
  const parsed = new URL(raw);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash || raw.includes("?") || raw.includes("#")) {
    problems.push(`${path}: must be an origin with no path: ${raw}`);
    return undefined;
  }
  return parsed.origin;
}
