// US1: sign in with an allowed account (T045). Runs against the static export with the mocked
// backend; real Google sign-in is covered by the deployed smoke tests (T053).

import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { ASSETS_URL, COGNITO_DOMAIN, expect, test } from "./fixtures/mock-backend";

const signInButton = (page: Page) => page.getByRole("button", { name: "Sign in with Google" });
// Next's route announcer is also role="alert", so match the banner by its title.
const alert = (page: Page, title: string) => page.getByRole("alert").filter({ hasText: title });

test.describe("US1 access", () => {
  test("the landing page offers sign-in and loads nothing from the catalog", async ({ page, backend }) => {
    await page.goto("/");
    await expect(signInButton(page)).toBeEnabled();
    await page.waitForLoadState("networkidle");
    expect(backend.requestsTo("appsync")).toEqual([]);
    expect(backend.requestsTo("assets")).toEqual([]);
  });

  test("sign-in goes to the Cognito hosted UI with Google", async ({ page }) => {
    await page.goto("/");
    const authorize = page.waitForRequest((r) => r.url().startsWith(`${COGNITO_DOMAIN}/oauth2/authorize`));
    await signInButton(page).click();
    const params = new URL((await authorize).url()).searchParams;
    expect(params.get("identity_provider")).toBe("GoogleWorkspace");
    expect(params.get("response_type")).toBe("code");
    expect(params.get("redirect_uri")).toBe("http://localhost:4173/auth/callback/");
  });

  test("a refused account sees “authorized accounts only”", async ({ page }) => {
    await page.goto("/?error=domain");
    await expect(alert(page, "That Google account can’t sign in.")).toContainText(
      "only accepts accounts on its allowed Google Workspace domain",
    );
  });

  test("a pre-sign-up rejection on the callback lands on the domain error", async ({ page }) => {
    await page.goto("/auth/callback/?error_description=PreSignUp+failed+with+error+ONLY_ALLOWED_DOMAIN.+&error=invalid_request");
    await expect(page).toHaveURL("/?error=domain");
    await expect(alert(page, "That Google account can’t sign in.")).toBeVisible();
  });

  test("a signed-in visitor to / goes to browse", async ({ page, signedIn }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/browse/");
    await expect(page.getByRole("button", { name: `Account menu for ${signedIn.name}` })).toBeVisible();
  });

  test("a signed-out visitor to /browse/ goes to /", async ({ page, backend }) => {
    await page.goto("/browse/");
    await expect(page).toHaveURL("/");
    await expect(signInButton(page)).toBeEnabled();
    expect(backend.requestsTo("assets")).toEqual([]);
  });

  test("sign-out clears the asset session and lands on /", async ({ page, backend, signedIn }) => {
    await page.goto("/browse/");
    await page.getByRole("button", { name: `Account menu for ${signedIn.name}` }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/");
    await expect(signInButton(page)).toBeEnabled();
    const signoutCalls = backend.requestsTo("assets").filter((r) => r.url === `${ASSETS_URL}/_session/signout`);
    expect(signoutCalls.filter((r) => r.method === "GET")).toHaveLength(1);
    // Back on / by way of Cognito's /logout, which ends the hosted-UI session.
    const logout = backend.requestsTo("cognito").find((r) => r.url.startsWith(`${COGNITO_DOMAIN}/logout`));
    expect(new URL(logout!.url).searchParams.get("logout_uri")).toBe("http://localhost:4173/");

    // Still signed out after a reload.
    await page.reload();
    await expect(signInButton(page)).toBeEnabled();
  });

  test("the signed-in shell sets the asset cookies before loading any asset", async ({ page, backend, signedIn }) => {
    const session = page.waitForRequest((r) => r.url() === `${ASSETS_URL}/_session` && r.method() === "GET");
    await page.goto("/browse/");
    // The seeded ID token's payload carries the user's email.
    const token = (await session).headers()["x-id-token"]!;
    expect(JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).email).toBe(signedIn.email);

    await expect(page.getByRole("button", { name: `Account menu for ${signedIn.name}` })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const assets = backend.requestsTo("assets").filter((r) => r.method !== "OPTIONS");
    expect(assets[0]?.url).toBe(`${ASSETS_URL}/_session`);
  });

  test("a session the asset plane refuses goes back to /", async ({ page, signedIn }) => {
    void signedIn; // requested for its side effect: a seeded session
    // Registered after the mock backend's routes, so it takes precedence.
    await page.route(`${ASSETS_URL}/_session`, (route) =>
      route.fulfill({
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": route.request().headers()["origin"] ?? "*",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers": "*",
        },
        json: { error: "invalid_token" },
      }),
    );
    await page.goto("/browse/");
    await expect(page).toHaveURL("/");
    await expect(signInButton(page)).toBeEnabled();
  });

  test("the landing page has no accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expect(signInButton(page)).toBeEnabled();
    await expectNoA11yViolations(page);
  });
});
