import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { type Claims, InvalidTokenError, KeyFetchError, type TokenVerifier } from "./ports";

export interface JwtVerifierSettings {
  /** The `iss` every token must carry, exactly. */
  issuer: string;
  /** The `aud` every token must carry: the app's client ID. */
  audience: string;
  /** The `token_use` claim to require, for brokers that set one (Cognito: "id" or "access"). */
  tokenUse?: string;
  /** Where the issuer publishes its keys. Defaults to `<issuer>/.well-known/jwks.json`, Cognito's. */
  jwksUrl?: string;
}

/** Signing algorithms accepted. Every broker considered signs with RS256; `none` is never accepted. */
const ALGORITHMS = ["RS256"];

/** jose's errors for a key set that loaded but has no single key for the token: the token's fault. */
const TOKEN_KEY_ERRORS = [errors.JWKSNoMatchingKey, errors.JWKSMultipleMatchingKeys];

/**
 * A TokenVerifier for any OIDC issuer that publishes a JWKS (T136), in place of `aws-jwt-verify`,
 * which only knows Cognito. `keys` is for tests; deployments fetch the issuer's JWKS, which jose
 * caches and refreshes when it sees an unknown key ID.
 */
export function createJwtVerifier(settings: JwtVerifierSettings, keys?: JWTVerifyGetKey): TokenVerifier {
  const resolveKey: JWTVerifyGetKey =
    keys ?? createRemoteJWKSet(new URL(settings.jwksUrl ?? `${settings.issuer}/.well-known/jwks.json`), { timeoutDuration: 3000 });

  // Failures loading the keys are an outage; tell them apart from a bad token.
  const getKey: JWTVerifyGetKey = async (header, token) => {
    try {
      return await resolveKey(header, token);
    } catch (error) {
      if (TOKEN_KEY_ERRORS.some((type) => error instanceof type)) throw error;
      throw new KeyFetchError({ cause: error });
    }
  };

  return {
    async verify(token: string): Promise<Claims> {
      let payload: Claims;
      try {
        ({ payload } = await jwtVerify(token, getKey, {
          issuer: settings.issuer,
          audience: settings.audience,
          algorithms: ALGORITHMS,
          requiredClaims: ["exp", "iat"],
        }));
      } catch (error) {
        if (error instanceof KeyFetchError) throw error;
        throw new InvalidTokenError(error instanceof Error ? error.message : "Invalid token", { cause: error });
      }
      if (settings.tokenUse !== undefined && payload.token_use !== settings.tokenUse) {
        throw new InvalidTokenError(`Expected token_use "${settings.tokenUse}"`);
      }
      return payload;
    },
  };
}
