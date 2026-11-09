import { defineData } from "@aws-amplify/backend";
import { authEnvironment } from "../deployment";
import { schema } from "./schema";

export type { Schema } from "./schema";

/**
 * The catalog API (contracts/data-api.md). The user pool lives in another AWS account (research
 * R21), and Amplify's user-pool mode only works with a pool in its own backend, so AppSync checks
 * the pool's tokens through OIDC instead: the issuer is the pool, which has exactly one app client
 * (tests/infra/auth-stack.test.ts), so no client ID check is needed. Amplify's client sends the
 * Cognito access token in this mode.
 */
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "oidc",
    oidcAuthorizationMode: {
      oidcProviderName: "ContentForgeUserPool",
      oidcIssuerUrl: authEnvironment.issuerUrl,
      // Cognito's tokens last an hour. A refreshed token keeps the original sign-in's auth_time, and
      // refresh tokens last 7 days (research R3), so no valid session is older than 7 days plus an
      // hour. AppSync refuses anything older, as a second check on both.
      tokenExpireFromIssueInSeconds: 60 * 60,
      tokenExpiryFromAuthInSeconds: 7 * 24 * 60 * 60 + 60 * 60,
    },
  },
});
