import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The app's backend has no user pool of its own: it trusts the one in the auth account (research
// R21) through the handover parameter. This synthesizes the real backend against stand-in
// parameters (CONTENT_FORGE_PARAMETERS_DIR, in place of SSM) and checks that every consumer of the
// pool points at it.

const root = join(import.meta.dirname, "..", "..");
const ENV = "sandbox-vitest-auth";
const outDir = mkdtempSync(join(tmpdir(), "content-forge-backend-synth-"));

/** Writes one stand-in parameter under `dir`, the way SSM names it. */
function putParameter(dir: string, name: string, value: string) {
  mkdirSync(dirname(join(dir, name)), { recursive: true });
  writeFileSync(join(dir, name), value);
}

const POOL = {
  region: "us-west-2",
  userPoolId: "us-west-2_TESTpool1",
  userPoolClientId: "testclient0000000000000000",
  domain: "content-forge-dev-0123456789.auth.us-west-2.amazoncognito.com",
  appOrigin: "http://localhost:3000",
  allowedEmailDomain: "workspace.example.org",
};

type Resource = { Type: string; Properties: Record<string, unknown> };
type Template = { Resources?: Record<string, Resource>; Outputs?: Record<string, { Value: unknown }> };
let templates: Record<string, Template>;

const resources = (type: string) =>
  Object.values(templates).flatMap((t) => Object.values(t.Resources ?? {}).filter((r) => r.Type === type));

function synth(env: Record<string, string>) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      'await import("./amplify/backend.ts"); process.emit("message", "amplifySynth", undefined);',
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_BRANCH: ENV,
        CONTENT_FORGE_PARAMETERS_DIR: join(outDir, "parameters"),
        CDK_CONTEXT_JSON: JSON.stringify({
          "amplify-backend-namespace": "cf",
          "amplify-backend-name": "vitest",
          "amplify-backend-type": "sandbox",
        }),
        // Set only to test the stale-variable check, never inherited from the shell.
        ALLOWED_EMAIL_DOMAIN: "",
        ...env,
      },
    },
  );
}

beforeAll(() => {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  for (const dir of ["parameters", "parameters-wrong-origin"]) {
    putParameter(join(outDir, dir), `/content-forge/${ENV}/cloudfront/public-key`, publicKey);
  }
  putParameter(join(outDir, "parameters"), "/content-forge/auth/dev", JSON.stringify(POOL));
  const run = synth({ CDK_OUTDIR: join(outDir, "cdk.out") });
  if (run.status !== 0) throw new Error(`Backend synth failed:\n${run.stderr}`);

  const dir = join(outDir, "cdk.out");
  templates = Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith(".template.json"))
      .map((name) => [name, JSON.parse(readFileSync(join(dir, name), "utf8")) as Template]),
  );
}, 120_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("backend auth (research R21)", () => {
  it("creates no Cognito resources of its own", () => {
    const cognito = Object.values(templates).flatMap((t) =>
      Object.values(t.Resources ?? {}).filter((r) => r.Type.startsWith("AWS::Cognito::")),
    );
    expect(cognito).toEqual([]);
  });

  it("has AppSync trust only the auth account's pool, with bounded token ages", () => {
    const [api] = resources("AWS::AppSync::GraphQLApi");
    expect(api.Properties.AuthenticationType).toBe("OPENID_CONNECT");
    expect(api.Properties.OpenIDConnectConfig).toEqual({
      Issuer: `https://cognito-idp.us-west-2.amazonaws.com/${POOL.userPoolId}`,
      IatTTL: 3_600_000,
      AuthTTL: (7 * 24 + 1) * 3_600_000,
    });
    // AWS_IAM stays as Amplify's additional mode, which only signed AWS callers can use.
    expect(api.Properties.AdditionalAuthenticationProviders).toEqual([{ AuthenticationType: "AWS_IAM" }]);
  });

  it("has the session function verify tokens from that pool and client", () => {
    const sessionFunction = resources("AWS::Lambda::Function").find(
      (r) => (r.Properties.Environment as { Variables?: Record<string, unknown> })?.Variables?.USER_POOL_ID,
    );
    expect((sessionFunction?.Properties.Environment as { Variables: Record<string, unknown> }).Variables).toMatchObject({
      USER_POOL_ID: POOL.userPoolId,
      USER_POOL_CLIENT_ID: POOL.userPoolClientId,
      ALLOW_DOMAIN: POOL.allowedEmailDomain,
    });
  });

  it("writes the pool into amplify_outputs.json for the front end", () => {
    const root = Object.values(templates).find((t) => t.Outputs?.customOutputs);
    const value = JSON.stringify(root?.Outputs?.customOutputs.Value);
    for (const expected of [POOL.userPoolId, POOL.userPoolClientId, POOL.domain, "http://localhost:3000/auth/callback/"]) {
      expect(value).toContain(expected);
    }
  });

  it("tags every resource for the budget's cost filter", () => {
    const taggable = [
      "AWS::DynamoDB::Table",
      "AWS::Lambda::Function",
      "AWS::S3::Bucket",
      "AWS::AppSync::GraphQLApi",
      "AWS::CloudFront::Distribution",
    ];
    const untagged: string[] = [];
    for (const type of taggable) {
      expect(resources(type).length, type).toBeGreaterThan(0);
      for (const [file, template] of Object.entries(templates)) {
        for (const [id, resource] of Object.entries(template.Resources ?? {})) {
          // CDK's built-in custom resource handlers are raw resources that tags don't reach. They run
          // only during deploys and deletes, so their cost is nil.
          if (resource.Type !== type || /CustomResourceProviderHandler/.test(id)) continue;
          // Most resources take a list of tags; a few take the same as a map.
          const tags = resource.Properties.Tags as { Key: string; Value: string }[] | Record<string, string> | undefined;
          const value = Array.isArray(tags) ? tags.find((t) => t.Key === "project")?.Value : tags?.project;
          if (value !== "content-forge") untagged.push(`${file} ${id}`);
        }
      }
    }
    expect(untagged).toEqual([]);
  });

  it("refuses a pool whose redirect origin doesn't match the deployment", () => {
    const parameters = join(outDir, "parameters-wrong-origin");
    putParameter(parameters, "/content-forge/auth/dev", JSON.stringify({ ...POOL, appOrigin: "https://content.example.com" }));
    const run = synth({ CONTENT_FORGE_PARAMETERS_DIR: parameters, CDK_OUTDIR: join(outDir, "cdk.out.wrong") });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("redirects to https://content.example.com");
  }, 60_000);

  it("refuses a leftover ALLOWED_EMAIL_DOMAIN that disagrees with the pool", () => {
    const run = synth({ ALLOWED_EMAIL_DOMAIN: "example.com", CDK_OUTDIR: join(outDir, "cdk.out.stale-domain") });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("ALLOWED_EMAIL_DOMAIN is set, but the dev user pool allows a different domain");
  }, 60_000);

  it("stops with the bootstrap command when this deployment has no signing key", () => {
    const parameters = join(outDir, "parameters-no-key");
    putParameter(parameters, "/content-forge/auth/dev", JSON.stringify(POOL));
    const run = synth({ CONTENT_FORGE_PARAMETERS_DIR: parameters, CDK_OUTDIR: join(outDir, "cdk.out.no-key") });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(`create-signing-keys.sh --env ${ENV}`);
  }, 60_000);
});
