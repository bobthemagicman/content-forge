// @vitest-environment node
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, ParameterNotFound, SSMClient } from "@aws-sdk/client-ssm";
import { marshall } from "@aws-sdk/util-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudFrontSigner } from "../../../../amplify/lib/platform/aws/cloudfront-signer";
import { createDynamoCatalogStore } from "../../../../amplify/lib/platform/aws/dynamodb-catalog";
import { createSsmSettings } from "../../../../amplify/lib/platform/aws/ssm-settings";
import type { CatalogRecord, SettingsStore } from "../../../../amplify/lib/platform/ports";
import { describeAssetSignerContract } from "./contracts/asset-signer";
import { describeCatalogStoreContract } from "./contracts/catalog-store";
import { describeSettingsStoreContract } from "./contracts/settings-store";
import { createDirectorySettings } from "../../../../amplify/lib/platform/directory-settings";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ssm = mockClient(SSMClient);
const dynamodb = mockClient(DynamoDBClient);
beforeEach(() => {
  ssm.reset();
  dynamodb.reset();
});

// --- SSM ------------------------------------------------------------------------------------------

/** SSM as the API behaves: ParameterNotFound for a missing name, ciphertext without decryption. */
function fakeSsm(values: Record<string, string>, secrets: Record<string, string>) {
  ssm.on(GetParameterCommand).callsFake(({ Name, WithDecryption }: { Name: string; WithDecryption?: boolean }) => {
    if (Name in secrets) return { Parameter: { Value: WithDecryption ? secrets[Name] : "AQICAH-ciphertext" } };
    if (Name in values) return { Parameter: { Value: values[Name] } };
    throw new ParameterNotFound({ message: "not found", $metadata: {} });
  });
}

describeSettingsStoreContract("SSM Parameter Store", (values, secrets) => {
  fakeSsm(values, secrets);
  return createSsmSettings(new SSMClient({}));
});

// The offline store synth and tests use (amplify/parameters.ts). It has no encryption, so "secret"
// values are plain files.
describeSettingsStoreContract("a directory of files", (values, secrets) => {
  const dir = mkdtempSync(join(tmpdir(), "settings-"));
  for (const [name, value] of Object.entries({ ...values, ...secrets })) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), value);
  }
  return createDirectorySettings(dir);
});

describe("SSM settings", () => {
  it("asks for decryption only for secrets", async () => {
    fakeSsm({ "/app/x": "v" }, { "/app/k": "s" });
    const store = createSsmSettings(new SSMClient({}));
    await store.get("/app/x");
    await store.get("/app/k", { secret: true });
    expect(ssm.commandCalls(GetParameterCommand).map((c) => c.args[0].input)).toEqual([
      { Name: "/app/x" },
      { Name: "/app/k", WithDecryption: true },
    ]);
  });

  it("passes on errors other than a missing parameter", async () => {
    ssm.on(GetParameterCommand).rejects(new Error("AccessDeniedException"));
    await expect(createSsmSettings(new SSMClient({})).get("/app/x")).rejects.toThrow("AccessDeniedException");
  });
});

// --- DynamoDB -------------------------------------------------------------------------------------

/** GetItem with its projection applied, the way DynamoDB answers it. */
function fakeTable(records: CatalogRecord[]) {
  dynamodb.on(GetItemCommand).callsFake((input: { Key: { id: { S: string } }; ProjectionExpression: string; ExpressionAttributeNames?: Record<string, string> }) => {
    const record = records.find((r) => r.id === input.Key.id.S);
    if (!record) return {};
    const names = input.ProjectionExpression.split(", ").map((p) => input.ExpressionAttributeNames?.[p] ?? p);
    const projected = Object.fromEntries(Object.entries(record).filter(([k]) => names.includes(k)));
    return { Item: marshall(projected) };
  });
}

describeCatalogStoreContract("DynamoDB", (records) => {
  fakeTable(records);
  return createDynamoCatalogStore("Content-test", new DynamoDBClient({}));
});

describe("DynamoDB catalog store", () => {
  it("reads only the requested attributes, through placeholders", async () => {
    fakeTable([]);
    await createDynamoCatalogStore("Content-test", new DynamoDBClient({})).get("item-1", ["status", "demoEntryPath"]);
    expect(dynamodb.commandCalls(GetItemCommand)[0]!.args[0].input).toEqual({
      TableName: "Content-test",
      Key: { id: { S: "item-1" } },
      ProjectionExpression: "#f0, #f1",
      ExpressionAttributeNames: { "#f0": "status", "#f1": "demoEntryPath" },
    });
  });
});

// --- CloudFront -----------------------------------------------------------------------------------

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const NAMES = { assetHostSetting: "/s/host", keyPairIdSetting: "/s/kid", privateKeySetting: "/s/key" };

function settingsFor(assetHost: string): SettingsStore & { get: ReturnType<typeof vi.fn> } {
  const values: Record<string, string> = { "/s/host": assetHost, "/s/kid": "K2TEST", "/s/key": privateKey };
  return { get: vi.fn(async (name: string) => values[name]!) };
}

describeAssetSignerContract("CloudFront", ({ assetHost, demosHost }) =>
  createCloudFrontSigner(settingsFor(assetHost), { ...NAMES, demosHost }),
);

/** CloudFront's URL-safe base64: `+` → `-`, `=` → `_`, `/` → `~`. */
const fromCloudFrontBase64 = (value: string) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");
const EXPIRES = new Date("2026-11-07T00:00:00Z");

describe("CloudFront signer", () => {
  it("signs cookies CloudFront can verify, for /v/* on the asset host until the expiry", async () => {
    const signer = createCloudFrontSigner(settingsFor("assets.example.com"), { ...NAMES, demosHost: "d.example.net" });
    const cookies = await signer.sessionCookies(EXPIRES);
    const policy = fromCloudFrontBase64(cookies["CloudFront-Policy"]!);
    expect(JSON.parse(policy.toString())).toEqual({
      Statement: [{ Resource: "https://assets.example.com/v/*", Condition: { DateLessThan: { "AWS:EpochTime": EXPIRES.getTime() / 1000 } } }],
    });
    const signature = fromCloudFrontBase64(cookies["CloudFront-Signature"]!);
    expect(createVerify("RSA-SHA1").update(policy).verify(publicKey, signature)).toBe(true);
    expect(cookies["CloudFront-Key-Pair-Id"]).toBe("K2TEST");
  });

  it("signs a download URL with a canned policy that expires", async () => {
    const signer = createCloudFrontSigner(settingsFor("assets.example.com"), { ...NAMES, demosHost: "d.example.net" });
    const url = new URL(await signer.downloadUrl("a/item-1/theme.zip", EXPIRES));
    expect(url.searchParams.get("Expires")).toBe(String(EXPIRES.getTime() / 1000));
    expect(url.searchParams.get("Key-Pair-Id")).toBe("K2TEST");
    const canned = JSON.stringify({ Statement: [{ Resource: `https://assets.example.com/a/item-1/theme.zip`, Condition: { DateLessThan: { "AWS:EpochTime": EXPIRES.getTime() / 1000 } } }] });
    const signature = fromCloudFrontBase64(url.searchParams.get("Signature")!);
    expect(createVerify("RSA-SHA1").update(canned).verify(publicKey, signature)).toBe(true);
  });

  it("reads the settings once, decrypting the private key, and retries after a failure", async () => {
    const settings = settingsFor("assets.example.com");
    const real = settings.get.getMockImplementation()!;
    settings.get.mockRejectedValueOnce(new Error("Throttled"));
    const signer = createCloudFrontSigner(settings, { ...NAMES, demosHost: "d.example.net" });
    await expect(signer.sessionCookies(EXPIRES)).rejects.toThrow("Throttled");
    settings.get.mockImplementation(real);
    settings.get.mockClear();
    await signer.sessionCookies(EXPIRES);
    await signer.demoLaunchUrl("item-1", "index.html", EXPIRES);
    expect(settings.get).toHaveBeenCalledTimes(3);
    expect(settings.get).toHaveBeenCalledWith("/s/key", { secret: true });
  });
});
