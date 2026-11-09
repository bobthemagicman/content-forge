// Playwright fixtures that stand in for every backend the app talks to (T043): Cognito (hosted UI,
// token revocation), AppSync, and the asset plane. Any other request off the app's origin is
// aborted and fails the test, so a test can't pass by quietly reaching a real service.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page, type Route } from "@playwright/test";
import config from "./platform-config.e2e.json";

const root = join(__dirname, "..", "..", "..");

// The build bakes in whatever platform-config.json is at the repo root (T132). The mocks only match
// the fixture, so a sandbox's real file would send the app to endpoints nothing here answers.
const baked = JSON.parse(readFileSync(join(root, "platform-config.json"), "utf8"));
if (baked.auth?.clientId !== config.auth.clientId) {
  throw new Error(
    "E2E needs the fixture backend: move your sandbox's amplify_outputs.json aside, then rerun (prebuild regenerates platform-config.json from tests/e2e/fixtures/amplify_outputs.e2e.json).",
  );
}

const CLIENT_ID = config.auth.clientId;
export const COGNITO_DOMAIN = `https://${config.auth.domain}`;
export const APPSYNC_URL = config.catalog.url;
export const ASSETS_URL = config.assets.baseUrl;
// The user pool API (token revocation), at the issuer's origin.
const COGNITO_IDP = `${new URL(config.auth.issuer).origin}/`;

export type RequestKind = "appsync" | "assets" | "cognito" | "unexpected";

export interface LoggedRequest {
  kind: RequestKind;
  method: string;
  url: string;
  /** GraphQL operation name, for AppSync requests. */
  operation?: string;
}

export interface Backend {
  requests: LoggedRequest[];
  requestsTo(kind: RequestKind): LoggedRequest[];
}

export interface E2EUser {
  email: string;
  name: string;
}

const USER: E2EUser = { email: "e2e.user@example.com", name: "E2E User" };

function corsHeaders(route: Route): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": route.request().headers()["origin"] ?? "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "X-Session-Expires",
  };
}

const CONTENT_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};

async function installRoutes(page: Page, log: LoggedRequest[]) {
  const record = (kind: RequestKind, route: Route, operation?: string) =>
    log.push({ kind, method: route.request().method(), url: route.request().url(), operation });

  // Registered first, so it only sees off-origin requests the specific routes below don't claim.
  await page.route(
    (url) => url.hostname !== "localhost",
    async (route) => {
      record("unexpected", route);
      await route.abort("blockedbyclient");
    },
  );

  await page.route(`${APPSYNC_URL}*`, async (route) => {
    const body = route.request().postDataJSON() as { operationName?: string; query?: string } | null;
    const operation = body?.operationName ?? body?.query?.match(/\b(?:query|mutation)\s+(\w+)/)?.[1];
    record("appsync", route, operation);
    // Catalog responses arrive with the first AppSync caller (T084, fixture catalog T042).
    await route.fulfill({
      status: 200,
      headers: corsHeaders(route),
      json: { data: null, errors: [{ errorType: "E2E.Unmocked", message: `No mock for ${operation ?? "operation"}` }] },
    });
  });

  await page.route(`${ASSETS_URL}/**`, async (route) => {
    record("assets", route);
    const { pathname } = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders(route) });
    if (pathname.startsWith("/_session")) {
      const expires = new Date(Date.now() + 12 * 3600_000).toISOString();
      return route.fulfill({ status: 204, headers: { ...corsHeaders(route), "X-Session-Expires": expires } });
    }
    // Assets come from the demo catalog's generated files in public/demo/.
    const file = join(root, "public", "demo", ...pathname.split("/").filter(Boolean));
    try {
      const ext = pathname.slice(pathname.lastIndexOf("."));
      await route.fulfill({ status: 200, body: readFileSync(file), contentType: CONTENT_TYPES[ext] });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });

  // Hosted UI: tests assert on the authorize URL; nothing signs in through it.
  await page.route(`${COGNITO_DOMAIN}/oauth2/authorize*`, async (route) => {
    record("cognito", route);
    await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Cognito hosted UI (E2E stub)</title>" });
  });

  // Hosted UI logout: straight back to the app's logout URL. Away from `/`, Amplify picks the first
  // sign-out URI on the same hostname, which is why the fixture lists the E2E port first.
  await page.route(`${COGNITO_DOMAIN}/logout*`, async (route) => {
    record("cognito", route);
    const target = new URL(route.request().url()).searchParams.get("logout_uri") ?? "/";
    // A page that redirects, because Playwright's WebKit can't fulfill with a 3xx status.
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<script>location.replace(${JSON.stringify(target)})</script>`,
    });
  });

  // Amplify revokes the refresh token on sign-out.
  await page.route(COGNITO_IDP, async (route) => {
    record("cognito", route);
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders(route) });
    await route.fulfill({ status: 200, headers: corsHeaders(route), contentType: "application/x-amz-json-1.1", body: "{}" });
  });
}

/** An unsigned JWT: Amplify only decodes tokens on the client, and the mocks never verify them. */
function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", kid: "e2e" })}.${encode(payload)}.e2e-signature`;
}

/** localStorage entries for a federated Google session, in Amplify v6's key layout. */
function sessionEntries(user: E2EUser): Record<string, string> {
  const username = "google_e2e0000000000000000";
  const now = Math.floor(Date.now() / 1000);
  const common = { sub: "00000000-0000-4000-8000-0000000000e2", iat: now, exp: now + 3600, auth_time: now };
  const prefix = `CognitoIdentityServiceProvider.${CLIENT_ID}`;
  return {
    [`${prefix}.LastAuthUser`]: username,
    [`${prefix}.${username}.accessToken`]: fakeJwt({ ...common, token_use: "access", client_id: CLIENT_ID, username }),
    [`${prefix}.${username}.idToken`]: fakeJwt({
      ...common,
      token_use: "id",
      aud: CLIENT_ID,
      "cognito:username": username,
      email: user.email,
      name: user.name,
    }),
    [`${prefix}.${username}.refreshToken`]: "e2e-refresh-token",
    [`${prefix}.${username}.clockDrift`]: "0",
    // Marks the session as a hosted-UI sign-in, so signOut() goes through Cognito's /logout.
    [`${prefix}.oauthSignIn`]: "true,false",
  };
}

export const test = base.extend<{ backend: Backend; signedIn: E2EUser }>({
  backend: [
    async ({ page }, provide) => {
      const requests: LoggedRequest[] = [];
      await installRoutes(page, requests);
      await provide({ requests, requestsTo: (kind) => requests.filter((r) => r.kind === kind) });
      expect(requests.filter((r) => r.kind === "unexpected"), "requests to unmocked hosts").toEqual([]);
    },
    { auto: true },
  ],

  signedIn: async ({ page }, provide) => {
    // Seeds once per tab (sessionStorage survives navigations), so signing out stays signed out.
    await page.addInitScript((entries) => {
      if (sessionStorage.getItem("e2e:seeded")) return;
      sessionStorage.setItem("e2e:seeded", "1");
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, sessionEntries(USER));
    await provide(USER);
  },
});

export { expect };
