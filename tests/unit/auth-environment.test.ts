// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { authEnvFor, loadAuthEnvironment } from "../../amplify/auth-environment";

const dir = mkdtempSync(join(tmpdir(), "content-forge-auth-env-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => vi.unstubAllEnvs());

const POOL = {
  region: "us-west-2",
  userPoolId: "us-west-2_AbC123xyz",
  userPoolClientId: "1a2b3c4d5e6f7g8h9i0j1k2l3m",
  domain: "content-forge-dev-0123456789.auth.us-west-2.amazoncognito.com",
  appOrigin: "http://localhost:3000",
};

function useFile(contents: unknown) {
  const path = join(dir, `${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, JSON.stringify(contents));
  vi.stubEnv("CONTENT_FORGE_AUTH_FILE", path);
}

describe("auth environment handover (research R21)", () => {
  it("uses prod for master and dev for every sandbox", () => {
    expect(authEnvFor("master")).toBe("prod");
    expect(authEnvFor("sandbox-someone")).toBe("dev");
  });

  it("reads the pool and derives its token issuer", () => {
    useFile(POOL);
    expect(loadAuthEnvironment("dev")).toEqual({
      ...POOL,
      issuerUrl: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_AbC123xyz",
    });
  });

  it("says how to create a missing file", () => {
    vi.stubEnv("CONTENT_FORGE_AUTH_FILE", join(dir, "missing.json"));
    expect(() => loadAuthEnvironment("prod")).toThrow(/scripts\/auth\/deploy\.sh --env prod/);
  });

  it.each([
    ["userPoolId", "not a pool"],
    ["userPoolClientId", "UPPERCASE"],
    ["domain", "evil.example.com"],
    ["appOrigin", "http://localhost:3000/path"],
    ["region", undefined],
  ])("refuses a malformed %s", (key, value) => {
    useFile({ ...POOL, [key]: value });
    expect(() => loadAuthEnvironment("dev")).toThrow(`"${key}" is missing or malformed`);
  });

  it("refuses a pool from another region", () => {
    useFile({ ...POOL, userPoolId: "us-east-1_AbC123xyz" });
    expect(() => loadAuthEnvironment("dev")).toThrow(/isn't in region us-west-2/);
  });
});
