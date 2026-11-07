import { defineConfig, devices } from "@playwright/test";

// E2E runs against the static export with the mocked backend (tests/e2e/fixtures/mock-backend.ts).
// The port matches the redirect URIs in tests/e2e/fixtures/amplify_outputs.e2e.json.
const E2E_URL = "http://localhost:4173";

// Firefox and WebKit run the P1 stories only (FR-042).
const P1_SPECS = /us[123]-.*\.spec\.ts$/;

// `build:e2e` turns DEMO_MODE off (real AuthProvider) and points assets at the mocked asset host.
// E2E_SKIP_BUILD=1 reuses an existing E2E build in out/.
const serve = "node scripts/serve-out.mjs";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { trace: "retain-on-failure" },
  // Smoke tests run against a deployed site, so they need no local server.
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: process.env.E2E_SKIP_BUILD ? serve : `npm run build:e2e && ${serve}`,
        url: `${E2E_URL}/`,
        reuseExistingServer: false,
        timeout: 240_000,
      },
  projects: [
    { name: "e2e", testDir: "tests/e2e", use: { ...devices["Desktop Chrome"], baseURL: E2E_URL } },
    {
      name: "e2e-firefox",
      testDir: "tests/e2e",
      testMatch: P1_SPECS,
      use: { ...devices["Desktop Firefox"], baseURL: E2E_URL },
    },
    {
      name: "e2e-webkit",
      testDir: "tests/e2e",
      testMatch: P1_SPECS,
      use: { ...devices["Desktop Safari"], baseURL: E2E_URL },
    },
    {
      name: "smoke",
      testDir: "tests/smoke",
      testMatch: /.*\.smoke\.ts$/,
      use: { baseURL: process.env.SMOKE_BASE_URL, storageState: "tests/smoke/.auth/state.json" },
    },
  ],
});
