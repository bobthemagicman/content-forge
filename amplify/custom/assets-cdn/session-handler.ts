import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { getSignedCookies } from "@aws-sdk/cloudfront-signer";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { FetchError, JwksNotAvailableInCacheError, JwksValidationError } from "aws-jwt-verify/error";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

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
 */

const SESSION_SECONDS = 12 * 60 * 60;
// The same working day as previews: a demo tab can't renew its own cookies, and the spec allows
// demos to see each other (FR-027, FR-029). Matches MAX_AGE_SECONDS in demo-launch.js.
const DEMO_SESSION_SECONDS = SESSION_SECONDS;
const DEMO_PATH = /^\/_session\/demo\/([A-Za-z0-9-]{1,64})$/;
const COOKIE_NAMES = ["CloudFront-Policy", "CloudFront-Signature", "CloudFront-Key-Pair-Id"] as const;

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

const verifier = CognitoJwtVerifier.create({
  userPoolId: requireEnv("USER_POOL_ID"),
  clientId: requireEnv("USER_POOL_CLIENT_ID"),
  tokenUse: "id",
});

const ssm = new SSMClient({});
const dynamodb = new DynamoDBClient({});

interface SigningConfig {
  assetHost: string;
  keyPairId: string;
  privateKey: string;
}

let signingConfig: Promise<SigningConfig> | undefined;

async function readParameter(name: string, withDecryption = false): Promise<string> {
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: withDecryption }));
  if (!Parameter?.Value) throw new Error(`session-handler: SSM parameter ${name} is empty`);
  return Parameter.Value;
}

/** Reads the signing settings once per container. A failed read isn't cached, so the next call retries. */
function loadSigningConfig(): Promise<SigningConfig> {
  signingConfig ??= Promise.all([
    readParameter(requireEnv("ASSETS_DOMAIN_PARAM")),
    readParameter(requireEnv("KEY_PAIR_ID_PARAM")),
    readParameter(requireEnv("PRIVATE_KEY_PARAM"), true),
  ])
    .then(([assetHost, keyPairId, privateKey]) => ({ assetHost, keyPairId, privateKey }))
    .catch((error: unknown) => {
      signingConfig = undefined;
      throw error;
    });
  return signingConfig;
}

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

/** Failures to reach or read the user pool's signing keys: an outage, not a bad token. */
function isKeyFetchFailure(error: unknown): boolean {
  return error instanceof FetchError || error instanceof JwksValidationError || error instanceof JwksNotAvailableInCacheError;
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

  let claims: Awaited<ReturnType<typeof verifier.verify>>;
  try {
    claims = await verifier.verify(token);
  } catch (error) {
    // Telling the user to sign in again wouldn't help during an outage.
    if (isKeyFetchFailure(error)) {
      console.error("session-handler: could not load the user pool's signing keys", error);
      return json(500, "internal", origin);
    }
    return json(401, "invalid_token", origin);
  }

  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  // Typed as a boolean, but federated identities can carry it as the string "false".
  const emailVerified: unknown = claims.email_verified;
  const unverified = emailVerified === false || emailVerified === "false";
  // Google's hosted-domain claim, mapped on every sign-in (amplify/auth/resource.ts). Only
  // Workspace accounts have it, so this refuses a consumer account using a company address.
  const hostedDomain = claims["custom:hd"];
  const inWorkspace = typeof hostedDomain === "string" && hostedDomain.toLowerCase() === allowedDomain;
  if (!email.endsWith(`@${allowedDomain}`) || unverified || !inWorkspace) return json(403, "forbidden", origin);
  return undefined;
}

/** A custom policy for every URL under `resource`, valid until `expiresAt` (epoch seconds). */
function customPolicy(resource: string, expiresAt: number): string {
  return JSON.stringify({ Statement: [{ Resource: resource, Condition: { DateLessThan: { "AWS:EpochTime": expiresAt } } }] });
}

async function issueSession(event: APIGatewayProxyEventV2, origin: string | undefined): Promise<Result> {
  const denied = await authorize(event, origin);
  if (denied) return denied;

  try {
    const { assetHost, keyPairId, privateKey } = await loadSigningConfig();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const policy = customPolicy(`https://${assetHost}/v/*`, expiresAt);
    const signed = getSignedCookies({ keyPairId, privateKey, policy });
    const attributes = cookieAttributes(SESSION_SECONDS);
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders(origin),
        "Cache-Control": "no-store",
        "X-Session-Expires": new Date(expiresAt * 1000).toISOString(),
      },
      cookies: COOKIE_NAMES.map((name) => `${name}=${signed[name]}; ${attributes}`),
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
    const { Item } = await dynamodb.send(
      new GetItemCommand({
        TableName: contentTable,
        Key: { id: { S: id } },
        ProjectionExpression: "#status, demoEntryPath",
        ExpressionAttributeNames: { "#status": "status" },
      }),
    );
    // Drafts are as invisible here as they are in the catalog API.
    const entryPath = Item?.status?.S === "PUBLISHED" ? Item.demoEntryPath?.S : undefined;
    if (!entryPath) return json(404, "not_found", origin);

    const encodedEntry = encodeEntryPath(entryPath);
    if (!encodedEntry) {
      console.error(`session-handler: item ${id} has an invalid demoEntryPath`);
      return json(500, "internal", origin);
    }

    const { keyPairId, privateKey } = await loadSigningConfig();
    const expiresAt = Math.floor(Date.now() / 1000) + DEMO_SESSION_SECONDS;
    const signed = getSignedCookies({ keyPairId, privateKey, policy: customPolicy(`https://${demosHost}/${id}/*`, expiresAt) });
    // The values are URL-safe base64 and key IDs, so they need no encoding (URLSearchParams would
    // turn `~` into `%7E`, which the launch function would then copy into the cookie).
    const query = `p=${signed["CloudFront-Policy"]}&s=${signed["CloudFront-Signature"]}&k=${signed["CloudFront-Key-Pair-Id"]}`;
    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        url: `https://${demosHost}/_launch/${id}/${encodedEntry}?${query}`,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      }),
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
    cookies: COOKIE_NAMES.map((name) => `${name}=; ${attributes}`),
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
