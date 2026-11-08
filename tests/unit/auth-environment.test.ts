// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authEnvFor, loadAuthEnvironment, parseAuthEnvironment } from "../../amplify/auth-environment";

const dir = mkdtempSync(join(tmpdir(), "content-forge-auth-env-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  vi.unstubAllEnvs();
  rmSync(join(dir, "content-forge"), { recursive: true, force: true });
  vi.stubEnv("CONTENT_FORGE_PARAMETERS_DIR", dir);
});

const POOL = {
  region: "us-west-2",
  userPoolId: "us-west-2_AbC123xyz",
  userPoolClientId: "1a2b3c4d5e6f7g8h9i0j1k2l3m",
  domain: "content-forge-dev-0123456789.auth.us-west-2.amazoncognito.com",
  appOrigin: "http://localhost:3000",
};
const ISSUER = "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_AbC123xyz";

function useParameter(authEnv: "dev" | "prod", contents: string) {
  const path = join(dir, "content-forge", "auth", authEnv);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

describe("auth environment handover (research R21)", () => {
  it("uses prod for master and dev for every sandbox", () => {
    expect(authEnvFor("master")).toBe("prod");
    expect(authEnvFor("sandbox-someone")).toBe("dev");
  });

  it("reads the pool from /content-forge/auth/<env> and derives its token issuer", async () => {
    useParameter("dev", JSON.stringify(POOL));
    await expect(loadAuthEnvironment("dev")).resolves.toEqual({ ...POOL, issuerUrl: ISSUER });
  });

  it("drops fields it doesn't know", () => {
    expect(parseAuthEnvironment(JSON.stringify({ ...POOL, extra: "x" }), "test")).not.toHaveProperty("extra");
  });

  it("says how to create a missing parameter", async () => {
    await expect(loadAuthEnvironment("prod")).rejects.toThrow(
      /\/content-forge\/auth\/prod doesn't exist.*scripts\/auth\/deploy\.sh --env prod/,
    );
  });

  it("refuses a parameter that isn't JSON", () => {
    expect(() => parseAuthEnvironment("us-west-2_AbC123xyz", "/content-forge/auth/dev")).toThrow(
      "/content-forge/auth/dev: not valid JSON.",
    );
  });

  it.each([
    ["userPoolId", "not a pool"],
    ["userPoolClientId", "UPPERCASE"],
    ["domain", "evil.example.com"],
    ["appOrigin", "http://localhost:3000/path"],
    ["region", undefined],
  ])("refuses a malformed %s", (key, value) => {
    expect(() => parseAuthEnvironment(JSON.stringify({ ...POOL, [key]: value }), "test")).toThrow(
      `"${key}" is missing or malformed`,
    );
  });

  it("refuses a pool from another region", () => {
    expect(() => parseAuthEnvironment(JSON.stringify({ ...POOL, userPoolId: "us-east-1_AbC123xyz" }), "test")).toThrow(
      /isn't in region us-west-2/,
    );
  });
});
