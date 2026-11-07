import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { getSignedCookies } from "@aws-sdk/cloudfront-signer";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/**
 * The asset session endpoint behind CloudFront (contracts/assets-cdn.md, research R7, R8, R19).
 *
 * `GET /_session` trades a Cognito ID token for CloudFront signed cookies covering `/v/*`, and
 * `GET /_session/signout` clears them. CloudFront reaches this function URL through OAC, so the
 * token travels in `X-Id-Token`: OAC's SigV4 signature takes the `Authorization` header.
 */

const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE_NAMES = ["CloudFront-Policy", "CloudFront-Signature", "CloudFront-Key-Pair-Id"] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`session-handler: ${name} is not set`);
  return value;
}

const allowedOrigins = new Set(requireEnv("ALLOWED_ORIGINS").split(",").map((o) => o.trim()).filter(Boolean));
const allowedDomain = requireEnv("ALLOW_DOMAIN").toLowerCase();
const cookieMode = requireEnv("COOKIE_MODE");
if (cookieMode !== "same-site" && cookieMode !== "cross-site") {
  throw new Error(`session-handler: COOKIE_MODE must be same-site or cross-site, not ${cookieMode}`);
}

const verifier = CognitoJwtVerifier.create({
  userPoolId: requireEnv("USER_POOL_ID"),
  clientId: requireEnv("USER_POOL_CLIENT_ID"),
  tokenUse: "id",
});

const ssm = new SSMClient({});

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

function cookieAttributes(assetHost: string, maxAge: number): string {
  // Production: app and assets are same-site, so Lax first-party cookies scoped to the asset host.
  // Sandboxes: localhost and *.cloudfront.net are different sites, so host-only SameSite=None.
  const site = cookieMode === "same-site" ? `Domain=${assetHost}; SameSite=Lax` : "SameSite=None";
  return `${site}; Path=/; Secure; HttpOnly; Max-Age=${maxAge}`;
}

async function issueSession(event: APIGatewayProxyEventV2, origin: string | undefined): Promise<Result> {
  if (!origin || !allowedOrigins.has(origin)) return json(403, "forbidden", origin);

  const token = header(event, "X-Id-Token");
  if (!token) return json(401, "invalid_token", origin);

  let claims: Awaited<ReturnType<typeof verifier.verify>>;
  try {
    claims = await verifier.verify(token);
  } catch {
    return json(401, "invalid_token", origin);
  }

  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  // Typed as a boolean, but federated identities can carry it as the string "false".
  const emailVerified: unknown = claims.email_verified;
  const unverified = emailVerified === false || emailVerified === "false";
  if (!email.endsWith(`@${allowedDomain}`) || unverified) return json(403, "forbidden", origin);

  try {
    const { assetHost, keyPairId, privateKey } = await loadSigningConfig();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const policy = JSON.stringify({
      Statement: [
        { Resource: `https://${assetHost}/v/*`, Condition: { DateLessThan: { "AWS:EpochTime": expiresAt } } },
      ],
    });
    const signed = getSignedCookies({ keyPairId, privateKey, policy });
    const attributes = cookieAttributes(assetHost, SESSION_SECONDS);
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

async function clearSession(origin: string | undefined): Promise<Result> {
  try {
    const { assetHost } = await loadSigningConfig();
    const attributes = cookieAttributes(assetHost, 0);
    return {
      statusCode: 204,
      headers: { ...corsHeaders(origin), "Cache-Control": "no-store" },
      cookies: COOKIE_NAMES.map((name) => `${name}=; ${attributes}`),
    };
  } catch (error) {
    console.error("session-handler: could not clear the asset session", error);
    return json(500, "internal", origin);
  }
}

export async function handler(event: APIGatewayProxyEventV2): Promise<Result> {
  const origin = header(event, "Origin");
  const method = event.requestContext.http.method;
  const path = event.rawPath.replace(/\/+$/, "");

  if (path !== "/_session" && path !== "/_session/signout") return json(404, "not_found", origin);

  if (method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return json(403, "forbidden", origin);
    return { statusCode: 204, headers: { ...corsHeaders(origin), "Access-Control-Max-Age": "600" } };
  }
  if (method !== "GET") return json(405, "method_not_allowed", origin);

  return path === "/_session/signout" ? clearSession(origin) : issueSession(event, origin);
}
