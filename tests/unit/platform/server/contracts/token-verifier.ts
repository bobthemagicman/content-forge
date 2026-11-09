import { SignJWT, type JWK, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { InvalidTokenError, type TokenVerifier } from "../../../../../amplify/lib/platform/ports";

/** What a TokenVerifier adapter's test hands the contract: a verifier trusting `jwks`. */
export type MakeVerifier = (settings: { issuer: string; audience: string; tokenUse: string; jwks: { keys: JWK[] } }) => TokenVerifier;

export const ISSUER = "https://issuer.example.com/pool";
export const AUDIENCE = "client-123";

export async function testKeys() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: "key-1", alg: "RS256", use: "sig" };
  return { privateKey, jwks: { keys: [jwk] } };
}

type Key = Awaited<ReturnType<typeof testKeys>>["privateKey"];

/** An ID token for `ada@example.com`, valid for an hour, with any claim or header overridden. */
export function idToken(key: Key, claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  return new SignJWT({ token_use: "id", email: "ada@example.com", email_verified: true, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "key-1", ...header })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * Every TokenVerifier must accept exactly the tokens the asset plane accepts (contracts/assets-cdn.md):
 * signed by the issuer's key with RS256, from the configured issuer, for the configured audience,
 * with the configured token use, and unexpired.
 */
export function describeTokenVerifierContract(name: string, make: MakeVerifier) {
  describe(`TokenVerifier contract: ${name}`, () => {
    const setup = async () => {
      const keys = await testKeys();
      return { ...keys, verifier: make({ issuer: ISSUER, audience: AUDIENCE, tokenUse: "id", jwks: keys.jwks }) };
    };

    it("accepts a valid token and returns its claims", async () => {
      const { privateKey, verifier } = await setup();
      const claims = await verifier.verify(await idToken(privateKey, { "custom:hd": "example.com" }));
      expect(claims).toMatchObject({ iss: ISSUER, aud: AUDIENCE, email: "ada@example.com", "custom:hd": "example.com" });
    });

    const refusals: [string, (key: Key) => Promise<string>][] = [
      ["a token from another issuer", (key) => new SignJWT({ token_use: "id" }).setProtectedHeader({ alg: "RS256", kid: "key-1" }).setIssuer("https://evil.example.com/pool").setAudience(AUDIENCE).setIssuedAt().setExpirationTime("1h").sign(key)],
      ["a token for another client", (key) => new SignJWT({ token_use: "id" }).setProtectedHeader({ alg: "RS256", kid: "key-1" }).setIssuer(ISSUER).setAudience("other-client").setIssuedAt().setExpirationTime("1h").sign(key)],
      ["an expired token", (key) => new SignJWT({ token_use: "id" }).setProtectedHeader({ alg: "RS256", kid: "key-1" }).setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(Math.floor(Date.now() / 1000) - 3600).sign(key)],
      ["a token without an expiry", (key) => new SignJWT({ token_use: "id" }).setProtectedHeader({ alg: "RS256", kid: "key-1" }).setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt().sign(key)],
      ["the wrong token use", (key) => idToken(key, { token_use: "access" })],
      ["a token signed by another key", async () => idToken((await testKeys()).privateKey)],
      ["an unsigned token (alg: none)", async () => `${b64({ alg: "none", kid: "key-1" })}.${b64({ iss: ISSUER, aud: AUDIENCE, token_use: "id", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}.`],
      ["a token with an unknown key ID", (key) => idToken(key, {}, { kid: "key-2" })],
      ["something that isn't a JWT", async () => "header.payload.signature"],
    ];

    it.each(refusals)("refuses %s with InvalidTokenError", async (_, mint) => {
      const { privateKey, verifier } = await setup();
      await expect(verifier.verify(await mint(privateKey))).rejects.toBeInstanceOf(InvalidTokenError);
    });

    it("refuses an HS256 token keyed with the public key (algorithm confusion)", async () => {
      const { jwks, verifier } = await setup();
      const secret = new TextEncoder().encode(JSON.stringify(jwks.keys[0]));
      const token = await new SignJWT({ token_use: "id" }).setProtectedHeader({ alg: "HS256", kid: "key-1" }).setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt().setExpirationTime("1h").sign(secret);
      await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
    });
  });
}
