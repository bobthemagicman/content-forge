// @vitest-environment node
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidTokenError } from "../../../amplify/lib/platform/ports";

// The verifier itself is tested against real tokens in tests/unit/platform/server/; here it's a stub.
const verify = vi.fn();
const createJwtVerifier = vi.fn(() => ({ verify }));
vi.mock("../../../amplify/lib/platform/jwt-verifier", () => ({ createJwtVerifier }));

const ssm = mockClient(SSMClient);
const dynamodb = mockClient(DynamoDBClient);
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const APP = "https://content.example.com";
const HOST = "assets.example.com";
const DEMOS = "d111111abcdef8.cloudfront.net";
const ITEM_ID = "3f1c2b8e-9d4a-4c6b-8e2f-1a2b3c4d5e6f";
const PARAMS: Record<string, string> = {
  "/content-forge/test/assets/domain": HOST,
  "/content-forge/test/cloudfront/key-pair-id": "K2TESTKEYPAIR",
  "/content-forge/test/cloudfront/private-key": privateKey,
};

async function loadHandler(cookieMode = "same-site") {
  Object.assign(process.env, {
    USER_POOL_ID: "us-west-2_test",
    USER_POOL_CLIENT_ID: "client-test",
    ALLOWED_ORIGINS: APP,
    ALLOW_DOMAIN: "example.com",
    COOKIE_MODE: cookieMode,
    ASSETS_DOMAIN_PARAM: "/content-forge/test/assets/domain",
    KEY_PAIR_ID_PARAM: "/content-forge/test/cloudfront/key-pair-id",
    PRIVATE_KEY_PARAM: "/content-forge/test/cloudfront/private-key",
    DEMOS_DOMAIN: DEMOS,
    CONTENT_TABLE: "Content-test",
  });
  vi.resetModules();
  return (await import("../../../amplify/custom/assets-cdn/session-handler")).handler;
}

function request(path: string, { method = "GET", headers = {} as Record<string, string> } = {}) {
  return {
    rawPath: path,
    headers: { origin: APP, ...headers },
    requestContext: { http: { method } },
  } as unknown as APIGatewayProxyEventV2;
}

const withToken = (path = "/_session") => request(path, { headers: { "x-id-token": "header.payload.signature" } });

function cookies(result: APIGatewayProxyStructuredResultV2): Map<string, { value: string; attributes: string[] }> {
  return new Map(
    (result.cookies ?? []).map((cookie) => {
      const [pair, ...attributes] = cookie.split("; ");
      const at = pair!.indexOf("=");
      return [pair!.slice(0, at), { value: pair!.slice(at + 1), attributes }];
    }),
  );
}

/** CloudFront's URL-safe base64: `+` → `-`, `=` → `_`, `/` → `~`. */
const fromCloudFrontBase64 = (value: string) =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");

const body = (result: APIGatewayProxyStructuredResultV2) => JSON.parse(String(result.body));

beforeEach(() => {
  ssm.reset();
  dynamodb.reset();
  dynamodb.on(GetItemCommand).resolves({
    Item: { status: { S: "PUBLISHED" }, demoEntryPath: { S: "site files/index.html" } },
  });
  ssm.on(GetParameterCommand).callsFake(({ Name }: { Name: string }) => ({ Parameter: { Value: PARAMS[Name] } }));
  verify.mockReset().mockResolvedValue({ email: "ada@example.com", email_verified: true, "custom:hd": "example.com" });
  vi.useFakeTimers({ now: new Date("2026-11-06T12:00:00Z"), toFake: ["Date"] });
});

afterEach(() => vi.useRealTimers());

describe("GET /_session", () => {
  it("issues exactly the three CloudFront cookies, host-only and limited to /v/", async () => {
    const handler = await loadHandler();
    const result = await handler(withToken());

    expect(result.statusCode).toBe(204);
    const jar = cookies(result);
    expect([...jar.keys()].sort()).toEqual(["CloudFront-Key-Pair-Id", "CloudFront-Policy", "CloudFront-Signature"]);
    for (const { attributes } of jar.values()) {
      expect(attributes).toEqual(["Path=/v/", "Secure", "HttpOnly", "SameSite=Lax", "Max-Age=43200"]);
    }
    expect(jar.get("CloudFront-Key-Pair-Id")!.value).toBe("K2TESTKEYPAIR");
    expect(result.headers).toMatchObject({
      "Access-Control-Allow-Origin": APP,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "X-Session-Expires",
      "X-Session-Expires": "2026-11-07T00:00:00.000Z",
    });
  });

  it("signs a custom policy for /v/* that expires in 12 hours", async () => {
    const handler = await loadHandler();
    const jar = cookies(await handler(withToken()));

    const policy = fromCloudFrontBase64(jar.get("CloudFront-Policy")!.value);
    expect(JSON.parse(policy.toString())).toEqual({
      Statement: [
        {
          Resource: `https://${HOST}/v/*`,
          Condition: { DateLessThan: { "AWS:EpochTime": Date.parse("2026-11-07T00:00:00Z") / 1000 } },
        },
      ],
    });
    const signature = fromCloudFrontBase64(jar.get("CloudFront-Signature")!.value);
    expect(createVerify("RSA-SHA1").update(policy).verify(publicKey, signature)).toBe(true);
  });

  it("verifies the token as a Cognito ID token", async () => {
    const handler = await loadHandler();
    await handler(withToken());
    expect(createJwtVerifier).toHaveBeenLastCalledWith({
      issuer: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_test",
      audience: "client-test",
      tokenUse: "id",
    });
    expect(verify).toHaveBeenCalledWith("header.payload.signature");
  });

  it("rejects a missing token with 401", async () => {
    const handler = await loadHandler();
    const result = await handler(request("/_session"));
    expect(result.statusCode).toBe(401);
    expect(body(result)).toEqual({ error: "invalid_token" });
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    ["an expired", new InvalidTokenError('"exp" claim timestamp check failed')],
    ["a forged", new InvalidTokenError("no applicable key found in the JSON Web Key Set")],
    ["a malformed", new InvalidTokenError("Invalid Compact JWS")],
  ])("rejects %s token with 401", async (_, error) => {
    verify.mockRejectedValue(error);
    const handler = await loadHandler();
    const result = await handler(withToken());
    expect(result.statusCode).toBe(401);
    expect(body(result)).toEqual({ error: "invalid_token" });
    expect(result.cookies).toBeUndefined();
  });

  it.each([
    ["another domain", { email: "ada@gmail.com" }],
    ["a lookalike domain", { email: "ada@example.com.other.test" }],
    ["a subdomain", { email: "ada@sub.example.com" }],
    ["no email", {}],
    ["an unverified email", { email: "ada@example.com", email_verified: "false" }],
  ])("rejects %s with 403", async (_, claims) => {
    verify.mockResolvedValue(claims);
    const handler = await loadHandler();
    const result = await handler(withToken());
    expect(result.statusCode).toBe(403);
    expect(body(result)).toEqual({ error: "forbidden" });
    expect(result.cookies).toBeUndefined();
  });

  it("accepts the allowed domain in any case", async () => {
    verify.mockResolvedValue({ email: "Ada@Example.COM", "custom:hd": "Example.COM" });
    const handler = await loadHandler();
    expect((await handler(withToken())).statusCode).toBe(204);
  });

  it.each([
    ["has no hosted domain (a consumer Google account)", {}],
    ["is in another Workspace", { "custom:hd": "other.com" }],
    ["has a subdomain as its hosted domain", { "custom:hd": "sub.example.com" }],
    ["has a non-string hosted domain", { "custom:hd": ["example.com"] }],
  ])("rejects a token whose account %s with 403", async (_, claims) => {
    verify.mockResolvedValue({ email: "ada@example.com", email_verified: true, ...claims });
    const handler = await loadHandler();
    for (const path of ["/_session", "/_session/demo/abc-123"]) {
      const result = await handler(withToken(path));
      expect(result.statusCode).toBe(403);
      expect(result.cookies).toBeUndefined();
    }
  });

  it.each([
    ["a JWKS fetch failure", new TypeError("fetch failed")],
    ["a JWKS timeout", new Error("request timed out")],
  ])("answers 500, not 401, on %s", async (_, cause) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = await loadHandler();
    // The handler's own copy of the class: loadHandler() resets the module registry.
    const { KeyFetchError } = await import("../../../amplify/lib/platform/ports");
    verify.mockRejectedValue(new KeyFetchError({ cause }));
    const result = await handler(withToken());
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: "internal" });
  });

  it("rejects a disallowed origin with 403 and no CORS grant", async () => {
    const handler = await loadHandler();
    const result = await handler(
      request("/_session", { headers: { origin: "https://other.example.net", "x-id-token": "t" } }),
    );
    expect(result.statusCode).toBe(403);
    expect(result.headers).not.toHaveProperty("Access-Control-Allow-Origin");
    expect(verify).not.toHaveBeenCalled();
  });

  it("uses host-only SameSite=None cookies in cross-site mode", async () => {
    const handler = await loadHandler("cross-site");
    for (const { attributes } of cookies(await handler(withToken())).values()) {
      expect(attributes).toEqual(["Path=/v/", "Secure", "HttpOnly", "SameSite=None", "Max-Age=43200"]);
    }
  });

  it("answers 500 when the signing settings can't be read", async () => {
    ssm.on(GetParameterCommand).rejects(new Error("AccessDenied"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = await loadHandler();
    const result = await handler(withToken());
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: "internal" });
  });

  it("reads SSM once per container", async () => {
    const handler = await loadHandler();
    await handler(withToken());
    await handler(withToken());
    await handler(withToken());
    expect(ssm.commandCalls(GetParameterCommand)).toHaveLength(3);
    const privateKeyCall = ssm
      .commandCalls(GetParameterCommand)
      .find((call) => call.args[0].input.Name === "/content-forge/test/cloudfront/private-key");
    expect(privateKeyCall!.args[0].input.WithDecryption).toBe(true);
  });

  it("retries SSM after a failed read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    ssm.on(GetParameterCommand).callsFake(({ Name }: { Name: string }) => {
      if (++calls === 1) throw new Error("Throttled");
      return { Parameter: { Value: PARAMS[Name] } };
    });
    const handler = await loadHandler();
    expect((await handler(withToken())).statusCode).toBe(500);
    expect((await handler(withToken())).statusCode).toBe(204);
  });
});

describe("GET /_session/signout", () => {
  it("clears all three cookies with the attributes they were set with", async () => {
    const handler = await loadHandler();
    const result = await handler(request("/_session/signout"));

    expect(result.statusCode).toBe(204);
    const jar = cookies(result);
    expect([...jar.keys()].sort()).toEqual(["CloudFront-Key-Pair-Id", "CloudFront-Policy", "CloudFront-Signature"]);
    for (const { value, attributes } of jar.values()) {
      expect(value).toBe("");
      expect(attributes).toEqual(["Path=/v/", "Secure", "HttpOnly", "SameSite=Lax", "Max-Age=0"]);
    }
  });

  it("clears the cookies even when SSM is unavailable", async () => {
    ssm.on(GetParameterCommand).rejects(new Error("AccessDenied"));
    const handler = await loadHandler();
    expect((await handler(request("/_session/signout"))).statusCode).toBe(204);
    expect(ssm.commandCalls(GetParameterCommand)).toHaveLength(0);
  });
});

describe("OPTIONS preflight", () => {
  it("returns 204 with the CORS headers from the contract", async () => {
    const handler = await loadHandler();
    const result = await handler(request("/_session", { method: "OPTIONS" }));
    expect(result.statusCode).toBe(204);
    expect(result.headers).toMatchObject({
      "Access-Control-Allow-Origin": APP,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "X-Id-Token",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Expose-Headers": "X-Session-Expires",
      Vary: "Origin",
    });
  });

  it("refuses a preflight from a disallowed origin", async () => {
    const handler = await loadHandler();
    const result = await handler(request("/_session", { method: "OPTIONS", headers: { origin: "https://other.example.net" } }));
    expect(result.statusCode).toBe(403);
  });
});

describe("other requests", () => {
  it("answers 404 for unknown paths and 405 for other methods", async () => {
    const handler = await loadHandler();
    expect((await handler(request("/_sessions"))).statusCode).toBe(404);
    expect((await handler(request("/_session", { method: "POST" }))).statusCode).toBe(405);
  });

  it("refuses to start with an unknown cookie mode", async () => {
    await expect(loadHandler("lax")).rejects.toThrow(/COOKIE_MODE/);
  });
});

describe("GET /_session/demo/<id>", () => {
  const demoPath = `/_session/demo/${ITEM_ID}`;

  it("returns a 12-hour launch link on the demo host, signed for that demo only", async () => {
    const handler = await loadHandler();
    const result = await handler(withToken(demoPath));

    expect(result.statusCode).toBe(200);
    expect(result.cookies).toBeUndefined();
    expect(result.headers).toMatchObject({ "Access-Control-Allow-Origin": APP, "Cache-Control": "no-store" });
    const { url, expiresAt } = body(result);
    expect(expiresAt).toBe("2026-11-07T00:00:00.000Z");

    const link = new URL(url);
    expect(link.origin).toBe(`https://${DEMOS}`);
    expect(link.pathname).toBe(`/_launch/${ITEM_ID}/site%20files/index.html`);
    expect([...link.searchParams.keys()]).toEqual(["p", "s", "k"]);
    expect(link.searchParams.get("k")).toBe("K2TESTKEYPAIR");

    const raw = (name: string) => new RegExp(`[?&]${name}=([^&]*)`).exec(url)![1]!;
    expect(raw("p")).toMatch(/^[A-Za-z0-9_~-]+$/);
    const policy = fromCloudFrontBase64(raw("p"));
    expect(JSON.parse(policy.toString())).toEqual({
      Statement: [
        {
          Resource: `https://${DEMOS}/${ITEM_ID}/*`,
          Condition: { DateLessThan: { "AWS:EpochTime": Date.parse("2026-11-07T00:00:00Z") / 1000 } },
        },
      ],
    });
    const signature = fromCloudFrontBase64(raw("s"));
    expect(createVerify("RSA-SHA1").update(policy).verify(publicKey, signature)).toBe(true);
  });

  it("reads only the item's status and entry path", async () => {
    const handler = await loadHandler();
    await handler(withToken(demoPath));
    expect(dynamodb.commandCalls(GetItemCommand)[0]!.args[0].input).toEqual({
      TableName: "Content-test",
      Key: { id: { S: ITEM_ID } },
      ProjectionExpression: "#f0, #f1",
      ExpressionAttributeNames: { "#f0": "status", "#f1": "demoEntryPath" },
    });
  });

  it.each([
    ["a missing item", undefined],
    ["a draft", { status: { S: "DRAFT" }, demoEntryPath: { S: "index.html" } }],
    ["an item without a demo", { status: { S: "PUBLISHED" } }],
  ])("answers 404 for %s", async (_, Item) => {
    dynamodb.on(GetItemCommand).resolves({ Item });
    const handler = await loadHandler();
    const result = await handler(withToken(demoPath));
    expect(result.statusCode).toBe(404);
    expect(body(result)).toEqual({ error: "not_found" });
  });

  it.each(["../secret.html", "/index.html", "a//b.html", "a\\b.html", "./index.html"])(
    "refuses to link the stored entry path %s",
    async (entry) => {
      dynamodb.on(GetItemCommand).resolves({ Item: { status: { S: "PUBLISHED" }, demoEntryPath: { S: entry } } });
      const handler = await loadHandler();
      const result = await handler(withToken(demoPath));
      expect(result.statusCode).toBe(500);
    },
  );

  it("applies the same checks as /_session before reading the catalog", async () => {
    const handler = await loadHandler();
    expect((await handler(request(demoPath))).statusCode).toBe(401);
    verify.mockResolvedValueOnce({ email: "eve@example.org", email_verified: true });
    expect((await handler(withToken(demoPath))).statusCode).toBe(403);
    const elsewhere = request(demoPath, { headers: { origin: "https://other.example", "x-id-token": "t" } });
    expect((await handler(elsewhere)).statusCode).toBe(403);
    expect(dynamodb.commandCalls(GetItemCommand)).toHaveLength(0);
  });

  it("answers 500 when the catalog can't be read", async () => {
    dynamodb.on(GetItemCommand).rejects(new Error("throttled"));
    const handler = await loadHandler();
    expect((await handler(withToken(demoPath))).statusCode).toBe(500);
  });

  it("answers 404 for an id that isn't a plain identifier", async () => {
    const handler = await loadHandler();
    expect((await handler(withToken("/_session/demo/a%2Fb"))).statusCode).toBe(404);
    expect((await handler(withToken("/_session/demo/"))).statusCode).toBe(404);
    expect(dynamodb.commandCalls(GetItemCommand)).toHaveLength(0);
  });

  it("answers the CORS preflight", async () => {
    const handler = await loadHandler();
    const result = await handler(request(demoPath, { method: "OPTIONS" }));
    expect(result.statusCode).toBe(204);
    expect(result.headers).toMatchObject({ "Access-Control-Allow-Headers": "X-Id-Token" });
  });
});
