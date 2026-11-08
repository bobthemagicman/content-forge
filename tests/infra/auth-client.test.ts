import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The Cognito app client hands out tokens only through Google (research R3). A user who got an
// access token with `aws.cognito.signin.user.admin` could rewrite their own `custom:hd` and email,
// which the session function trusts. That scope comes with the client's non-OAuth flows (SRP,
// custom auth) and can be requested through OAuth only if the client allows it. These settings
// live in amplify/backend.ts and Amplify's defaults, so this synthesizes the real backend.

const root = join(import.meta.dirname, "..", "..");
const ENV = "sandbox-vitest-auth";
const keyFile = join(root, "amplify", "custom", "assets-cdn", "keys", `${ENV}.public-key.pem`);
const outDir = mkdtempSync(join(tmpdir(), "content-forge-auth-synth-"));

type Resource = { Type: string; Properties: Record<string, unknown> };
let client: Record<string, unknown>;
let mappedAttributes: string[];

beforeAll(() => {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  writeFileSync(keyFile, publicKey);
  try {
    const run = spawnSync(
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
          CDK_OUTDIR: outDir,
          CDK_CONTEXT_JSON: JSON.stringify({
            "amplify-backend-namespace": "cf",
            "amplify-backend-name": "vitest",
            "amplify-backend-type": "sandbox",
          }),
        },
      },
    );
    if (run.status !== 0) throw new Error(`Backend synth failed:\n${run.stderr}`);
  } finally {
    rmSync(keyFile, { force: true });
  }

  const authFile = readdirSync(outDir).find((name) => /auth[0-9A-F]+\.nested\.template\.json$/.test(name));
  if (!authFile) throw new Error(`No auth template in ${outDir}`);
  const resources = Object.values(
    (JSON.parse(readFileSync(join(outDir, authFile), "utf8")) as { Resources: Record<string, Resource> }).Resources,
  );
  const clients = resources.filter((r) => r.Type === "AWS::Cognito::UserPoolClient");
  expect(clients).toHaveLength(1);
  client = clients[0].Properties;
  mappedAttributes = resources
    .filter((r) => r.Type === "AWS::Cognito::UserPoolIdentityProvider")
    .flatMap((r) => Object.keys(r.Properties.AttributeMapping as Record<string, string>));
}, 120_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("Cognito app client (research R3)", () => {
  it("can't grant the scope that lets users write their own attributes", () => {
    expect(client.AllowedOAuthScopes).toEqual(["openid", "email", "profile"]);
  });

  it("uses only the authorization-code flow", () => {
    expect(client.AllowedOAuthFlows).toEqual(["code"]);
  });

  it("allows no sign-in flow outside OAuth, only refresh", () => {
    expect(client.ExplicitAuthFlows).toEqual(["ALLOW_REFRESH_TOKEN_AUTH"]);
  });

  it("offers Google and not Cognito's own sign-in form", () => {
    const providers = client.SupportedIdentityProviders as unknown[];
    expect(providers).toHaveLength(1);
    expect(providers).not.toContain("COGNITO");
    expect(providers[0]).toMatchObject({ Ref: expect.stringMatching(/GoogleWorkspace/) });
  });

  it("keeps the mapped attributes writable, or Google sign-in would fail", () => {
    // No WriteAttributes means Cognito's default: every attribute is writable by this client.
    // If someone narrows it later, the mapped ones (custom:hd and email among them) must stay.
    expect(mappedAttributes).toEqual(expect.arrayContaining(["custom:hd", "email"]));
    const write = client.WriteAttributes as string[] | undefined;
    if (write) expect(write).toEqual(expect.arrayContaining(mappedAttributes));
  });
});
