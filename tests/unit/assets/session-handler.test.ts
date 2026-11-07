// @vitest-environment node
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.fn();
vi.mock("aws-jwt-verify", () => ({ CognitoJwtVerifier: { create: () => ({ verify }) } }));

const ssm = mockClient(SSMClient);
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const APP = "https://content.example.com";
const HOST = "assets.example.com";
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
  ssm.on(GetParameterCommand).callsFake(({ Name }: { Name: string }) => ({ Parameter: { Value: PARAMS[Name] } }));
  verify.mockReset().mockResolvedValue({ email: "ada@example.com", email_verified: true });
  vi.useFakeTimers({ now: new Date("2026-11-06T12:00:00Z"), toFake: ["Date"] });
});

afterEach(() => vi.useRealTimers());

describe("GET /_session", () => {
  it("issues exactly the three CloudFront cookies with the production attributes", async () => {
    const handler = await loadHandler();
    const result = await handler(withToken());

    expect(result.statusCode).toBe(204);
    const jar = cookies(result);
    expect([...jar.keys()].sort()).toEqual(["CloudFront-Key-Pair-Id", "CloudFront-Policy", "CloudFront-Signature"]);
    for (const { attributes } of jar.values()) {
      expect(attributes).toEqual([`Domain=${HOST}`, "SameSite=Lax", "Path=/", "Secure", "HttpOnly", "Max-Age=43200"]);
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
    expect(verify).toHaveBeenCalledWith("header.payload.signature");
  });

  it("rejects a missing token with 401", async () => {
    const handler = await loadHandler();
    const result = await handler(request("/_session"));
    expect(result.statusCode).toBe(401);
    expect(body(result)).toEqual({ error: "invalid_token" });
    expect(verify).not.toHaveBeenCalled();
  });

  it.each(["expired", "invalid"])("rejects an %s token with 401", async (reason) => {
    verify.mockRejectedValue(new Error(`Token ${reason}`));
    const handler = await loadHandler();
    const result = await handler(withToken());
    expect(result.statusCode).toBe(401);
    expect(body(result)).toEqual({ error: "invalid_token" });
    expect(result.cookies).toBeUndefined();
  });

  it.each([
    ["another domain", { email: "ada@gmail.com" }],
    ["a lookalike domain", { email: "ada@example.com.evil.com" }],
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
    verify.mockResolvedValue({ email: "Ada@Example.COM" });
    const handler = await loadHandler();
    expect((await handler(withToken())).statusCode).toBe(204);
  });

  it("rejects a disallowed origin with 403 and no CORS grant", async () => {
    const handler = await loadHandler();
    const result = await handler(
      request("/_session", { headers: { origin: "https://evil.example.net", "x-id-token": "t" } }),
    );
    expect(result.statusCode).toBe(403);
    expect(result.headers).not.toHaveProperty("Access-Control-Allow-Origin");
    expect(verify).not.toHaveBeenCalled();
  });

  it("uses host-only SameSite=None cookies in cross-site mode", async () => {
    const handler = await loadHandler("cross-site");
    for (const { attributes } of cookies(await handler(withToken())).values()) {
      expect(attributes).toEqual(["SameSite=None", "Path=/", "Secure", "HttpOnly", "Max-Age=43200"]);
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
    await handler(withToken("/_session/signout"));
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
  it("clears all three cookies", async () => {
    const handler = await loadHandler();
    const result = await handler(request("/_session/signout"));

    expect(result.statusCode).toBe(204);
    const jar = cookies(result);
    expect([...jar.keys()].sort()).toEqual(["CloudFront-Key-Pair-Id", "CloudFront-Policy", "CloudFront-Signature"]);
    for (const { value, attributes } of jar.values()) {
      expect(value).toBe("");
      expect(attributes).toContain("Max-Age=0");
      expect(attributes).toContain(`Domain=${HOST}`);
    }
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
    const result = await handler(request("/_session", { method: "OPTIONS", headers: { origin: "https://evil.example.net" } }));
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
