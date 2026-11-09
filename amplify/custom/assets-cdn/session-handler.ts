import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createCloudFrontSigner } from "../../lib/platform/aws/cloudfront-signer";
import { createDynamoCatalogStore } from "../../lib/platform/aws/dynamodb-catalog";
import { createSsmSettings } from "../../lib/platform/aws/ssm-settings";
import { isWorkspaceMember } from "../../lib/platform/identity";
import { createJwtVerifier } from "../../lib/platform/jwt-verifier";
import { type Claims, KeyFetchError } from "../../lib/platform/ports";

/**
 * The asset session endpoint behind CloudFront (contracts/assets-cdn.md, research R7, R8, R19).
 *
 * - `GET /_session` trades a Cognito ID token for CloudFront signed cookies covering `/v/*`.
 * - `GET /_session/signout` clears them.
 * - `GET /_session/demo/<id>` returns a 12-hour launch link for a published item's demo, which
 *   lives on the separate demo host (research R20).
 *
 * CloudFront reaches this function URL through OAC, so the token travels in `X-Id-Token`: OAC's
 * SigV4 signature takes the `Authorization` header.
 *
 * Every cloud call goes through a port (amplify/lib/platform/ports.ts, T136): the token check, the
 * signing settings, the catalog read and the CloudFront signing.
 */

const SESSION_SECONDS = 12 * 60 * 60;
// The same working day as previews: a demo tab can't renew its own cookies, and the spec allows
// demos to see each other (FR-027, FR-029). Matches MAX_AGE_SECONDS in demo-launch.js.
const DEMO_SESSION_SECONDS = SESSION_SECONDS;
const DEMO_PATH = /^\/_session\/demo\/([A-Za-z0-9-]{1,64})$/;
// Where the user pool puts Google's hosted domain (infra/auth/lib/auth-stack.ts).
const HOSTED_DOMAIN_CLAIM = "custom:hd";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`session-handler: ${name} is not set`);
  return value;
}

const allowedOrigins = new Set(requireEnv("ALLOWED_ORIGINS").split(",").map((o) => o.trim()).filter(Boolean));
const allowedDomain = requireEnv("ALLOW_DOMAIN").toLowerCase();
const cookieMode = requireEnv("COOKIE_MODE");
const demosHost = requireEnv("DEMOS_DOMAIN");
const contentTable = requireEnv("CONTENT_TABLE");
if (cookieMode !== "same-site" && cookieMode !== "cross-site") {
  throw new Error(`session-handler: COOKIE_MODE must be same-site or cross-site, not ${cookieMode}`);
}

const userPoolId = requireEnv("USER_POOL_ID");
// A user pool ID starts with its region: `us-west-2_AbC123`.
const userPoolRegion = userPoolId.split("_")[0];

// Cognito ID tokens only: they carry the email and hosted domain, and their audience is the client.
const verifier = createJwtVerifier({
  issuer: `https://cognito-idp.${userPoolRegion}.amazonaws.com/${userPoolId}`,
  audience: requireEnv("USER_POOL_CLIENT_ID"),
  tokenUse: "id",
});
const signer = createCloudFrontSigner(createSsmSettings(), {
  assetHostSetting: requireEnv("ASSETS_DOMAIN_PARAM"),
  keyPairIdSetting: requireEnv("KEY_PAIR_ID_PARAM"),
  privateKeySetting: requireEnv("PRIVATE_KEY_PARAM"),
  demosHost,
});
const catalog = createDynamoCatalogStore(contentTable);

type Result = APIGatewayProxyStructuredResultV2;

function header(event: APIGatewayProxyEventV2, name: string): string | undefined {
  // Function URLs lower-case header names.
  return event.headers?.[name.toLowerCase()];
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin || !allowedOrigins.has(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "X-Id-Token",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Expose-Headers": "X-Session-Expires",
    Vary: "Origin",
  };
}

function json(statusCode: number, error: string, origin: string | undefined): Result {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ error }),
  };
}

/**
 * Host-only (no `Domain`, so no other host ever receives them) and limited to `/v/`, the only path the
 * signed policy covers. Production: app and assets are same-site, so first-party `Lax` cookies.
 * Sandboxes: localhost and *.cloudfront.net are different sites, so `SameSite=None`.
 */
function cookieAttributes(maxAge: number): string {
  const sameSite = cookieMode === "same-site" ? "Lax" : "None";
  return `Path=/v/; Secure; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

/**
 * The checks every signed grant needs: an allowed `Origin`, a valid Cognito ID token, a verified
 * address in the allowed domain, and that domain as the Google Workspace (`custom:hd`). Returns the
 * error response, or `undefined` when all pass.
 */
async function authorize(event: APIGatewayProxyEventV2, origin: string | undefined): Promise<Result | undefined> {
  if (!origin || !allowedOrigins.has(origin)) return json(403, "forbidden", origin);

  const token = header(event, "X-Id-Token");
  if (!token) return json(401, "invalid_token", origin);

  let claims: Claims;
  try {
    claims = await verifier.verify(token);
  } catch (error) {
    // Telling the user to sign in again wouldn't help during an outage.
    if (error instanceof KeyFetchError) {
      console.error("session-handler: could not load the user pool's signing keys", error);
      return json(500, "internal", origin);
    }
    return json(401, "invalid_token", origin);
  }

  if (!isWorkspaceMember(claims, allowedDomain, HOSTED_DOMAIN_CLAIM)) return json(403, "forbidden", origin);
  return undefined;
}

async function issueSession(event: APIGatewayProxyEventV2, origin: string | undefined): Promise<Result> {
  const denied = await authorize(event, origin);
  if (denied) return denied;

  try {
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + SESSION_SECONDS) * 1000);
    const signed = await signer.sessionCookies(expiresAt);
    const attributes = cookieAttributes(SESSION_SECONDS);
    return {
      statusCode: 204,
      headers: { ...corsHeaders(origin), "Cache-Control": "no-store", "X-Session-Expires": expiresAt.toISOString() },
      cookies: Object.entries(signed).map(([name, value]) => `${name}=${value}; ${attributes}`),
    };
  } catch (error) {
    console.error("session-handler: could not sign the asset session", error);
    return json(500, "internal", origin);
  }
}

/**
 * The demo's entry path as URL path segments, or `undefined` if it isn't a plain relative path.
 * Ingest validates it too (data-model.md); this keeps a bad record from producing a bad link.
 */
function encodeEntryPath(entryPath: string): string | undefined {
  const segments = entryPath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment.includes("\\"))) {
    return undefined;
  }
  return segments.map(encodeURIComponent).join("/");
}

/**
 * A launch link for one published item's demo. The demo host's `/_launch/*` function turns the
 * signed values into cookies scoped to `/<id>/` and redirects to the entry page (demo-launch.js).
 */
async function issueDemoLaunch(event: APIGatewayProxyEventV2, origin: string | undefined, id: string): Promise<Result> {
  const denied = await authorize(event, origin);
  if (denied) return denied;

  try {
    const item = await catalog.get(id, ["status", "demoEntryPath"]);
    // Drafts are as invisible here as they are in the catalog API.
    const entryPath = item?.status === "PUBLISHED" ? item.demoEntryPath : undefined;
    if (!entryPath) return json(404, "not_found", origin);

    const encodedEntry = encodeEntryPath(entryPath);
    if (!encodedEntry) {
      console.error(`session-handler: item ${id} has an invalid demoEntryPath`);
      return json(500, "internal", origin);
    }

    const expiresAt = new Date((Math.floor(Date.now() / 1000) + DEMO_SESSION_SECONDS) * 1000);
    const url = await signer.demoLaunchUrl(id, encodedEntry, expiresAt);
    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ url, expiresAt: expiresAt.toISOString() }),
    };
  } catch (error) {
    console.error("session-handler: could not issue the demo launch link", error);
    return json(500, "internal", origin);
  }
}

function clearSession(origin: string | undefined): Result {
  // Same name, host, and path as the cookies being cleared, so the browser replaces them.
  const attributes = cookieAttributes(0);
  return {
    statusCode: 204,
    headers: { ...corsHeaders(origin), "Cache-Control": "no-store" },
    cookies: signer.cookieNames.map((name) => `${name}=; ${attributes}`),
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<Result> {
  const origin = header(event, "Origin");
  const method = event.requestContext.http.method;
  const path = event.rawPath.replace(/\/+$/, "");

  const demoId = DEMO_PATH.exec(path)?.[1];
  if (path !== "/_session" && path !== "/_session/signout" && !demoId) return json(404, "not_found", origin);

  if (method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return json(403, "forbidden", origin);
    return { statusCode: 204, headers: { ...corsHeaders(origin), "Access-Control-Max-Age": "600" } };
  }
  if (method !== "GET") return json(405, "method_not_allowed", origin);

  if (demoId) return issueDemoLaunch(event, origin, demoId);
  return path === "/_session/signout" ? clearSession(origin) : issueSession(event, origin);
}
