// @vitest-environment node
import { createLocalJWKSet } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createJwtVerifier } from "../../../../amplify/lib/platform/jwt-verifier";
import { InvalidTokenError, KeyFetchError } from "../../../../amplify/lib/platform/ports";
import { AUDIENCE, ISSUER, describeTokenVerifierContract, idToken, testKeys } from "./contracts/token-verifier";

describeTokenVerifierContract("jose with a local key set", ({ jwks, ...settings }) =>
  createJwtVerifier(settings, createLocalJWKSet(jwks)),
);

// The same contract with the keys fetched the way deployments fetch them.
describeTokenVerifierContract("jose with the issuer's published JWKS", ({ jwks, ...settings }) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(jwks)));
  return createJwtVerifier(settings);
});

describe("createJwtVerifier with a remote JWKS", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the keys from <issuer>/.well-known/jwks.json, Cognito's location, by default", async () => {
    const { privateKey, jwks } = await testKeys();
    const fetchMock = vi.fn(async () => Response.json(jwks));
    vi.stubGlobal("fetch", fetchMock);
    await createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE }).verify(await idToken(privateKey));
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(`${ISSUER}/.well-known/jwks.json`);
  });

  it.each([
    ["the request fails", async () => Promise.reject(new TypeError("fetch failed"))],
    ["the issuer answers 503", async () => new Response("unavailable", { status: 503 })],
    ["the answer isn't JSON", async () => new Response("<html>", { status: 200 })],
    ["the answer isn't a key set", async () => Response.json({ keys: "none" })],
  ])("reports KeyFetchError, not a bad token, when %s", async (_, answer) => {
    const { privateKey } = await testKeys();
    vi.stubGlobal("fetch", vi.fn(answer));
    const error = await createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE })
      .verify(await idToken(privateKey))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KeyFetchError);
  });

  it("checks token_use only when it's configured", async () => {
    const { privateKey, jwks } = await testKeys();
    const verifier = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE }, createLocalJWKSet(jwks));
    await expect(verifier.verify(await idToken(privateKey, { token_use: "access" }))).resolves.toMatchObject({ token_use: "access" });
    const strict = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, tokenUse: "id" }, createLocalJWKSet(jwks));
    await expect(strict.verify(await idToken(privateKey, { token_use: undefined }))).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
