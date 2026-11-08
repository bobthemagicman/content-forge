import { defineBackend } from "@aws-amplify/backend";
import { existsSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { preSignUp } from "./auth/pre-sign-up/resource";
import { auth } from "./auth/resource";
import { ALLOWED_EMAIL_DOMAIN, APP_ORIGIN, ASSETS_DOMAIN, HOSTED_ZONE_NAME, LOCAL_ORIGIN } from "./config";
import { AssetsCdn } from "./custom/assets-cdn/construct";
import { data } from "./data/resource";
import { resolveEnvName } from "./environment";

const backend = defineBackend({ auth, data, preSignUp });

// --- Environment (research R19) ---------------------------------------------------------------
// Amplify Hosting sets AWS_BRANCH; a personal `ampx sandbox` doesn't.
const envName = resolveEnvName(process.env.AWS_BRANCH, userInfo().username);
const isProduction = envName === "master";

// The domain settings default to `example.com` placeholders so the real domain stays out of this
// repo. Production must set them: a placeholder deploy would fail closed, but confusingly.
if (isProduction) {
  const missing = ["ALLOWED_EMAIL_DOMAIN", "APP_ORIGIN", "ASSETS_DOMAIN"].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Production needs ${missing.join(", ")} set on the Amplify app (quickstart §2).`);
  }
}

// --- Auth overrides ---------------------------------------------------------------------------
const { cfnIdentityPool, cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;

// No guest identities. The app never uses AWS credentials (src/lib/auth/amplify-config.ts leaves
// the identity pool out), so a guest identity would only be an unused door.
cfnIdentityPool.allowUnauthenticatedIdentities = false;

// No self-service sign-up; accounts come only from federated Google sign-in, which the pre-sign-up
// trigger limits to the allowed domain (research R3). Verify in T054 that first-time Google sign-in
// still works with this on; if it doesn't, remove it.
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };

// Refresh tokens last 7 days (research R3).
cfnUserPoolClient.refreshTokenValidity = 7;
cfnUserPoolClient.tokenValidityUnits = { refreshToken: "days" };

// Google is the only way to get tokens from this client (research R3): no Cognito sign-in form,
// and no SRP or custom-auth flows, only the authorization-code flow plus refresh. Tokens from
// those other flows always carry `aws.cognito.signin.user.admin`, the scope that lets a user
// rewrite their own attributes. `custom:hd` and `email` must stay writable by this client,
// because Cognito rewrites mapped attributes on every Google sign-in, so the scope is the guard.
// tests/infra/auth-client.test.ts checks all three settings.
cfnUserPoolClient.supportedIdentityProviders = cfnUserPoolClient.supportedIdentityProviders?.filter(
  (provider) => provider !== "COGNITO",
);
cfnUserPoolClient.explicitAuthFlows = ["ALLOW_REFRESH_TOKEN_AUTH"];

// --- Asset plane (research R6–R8) -------------------------------------------------------------
const publicKeyPath = fileURLToPath(new URL(`./custom/assets-cdn/keys/${envName}.public-key.pem`, import.meta.url));
if (!existsSync(publicKeyPath)) {
  throw new Error(
    `No CloudFront signing key for environment "${envName}" (${publicKeyPath}). ` +
      `Run scripts/bootstrap/create-signing-keys.sh --env ${envName} --profile <profile>, then commit the public key.`,
  );
}

const assets = new AssetsCdn(backend.createStack("assets"), "AssetsCdn", {
  envName,
  isProduction,
  publicKeyPem: readFileSync(publicKeyPath, "utf8"),
  userPoolId: backend.auth.resources.userPool.userPoolId,
  userPoolClientId: backend.auth.resources.userPoolClient.userPoolClientId,
  allowedOrigins: [isProduction ? APP_ORIGIN : LOCAL_ORIGIN],
  allowedEmailDomain: ALLOWED_EMAIL_DOMAIN,
  contentTable: backend.data.resources.tables["Content"],
  ...(isProduction && {
    assetsDomain: ASSETS_DOMAIN,
    certificateArn: process.env.ASSETS_CERT_ARN,
    hostedZoneId: process.env.HOSTED_ZONE_ID,
    hostedZoneName: HOSTED_ZONE_NAME,
    budgetAlertEmail: process.env.BUDGET_ALERT_EMAIL,
  }),
});

// --- Outputs (contracts/data-api.md, custom outputs) ------------------------------------------
backend.addOutput({
  custom: {
    assetsBaseUrl: assets.assetsBaseUrl,
    assetsBucketName: assets.bucket.bucketName,
    contentTableName: backend.data.resources.tables["Content"].tableName,
    region: backend.stack.region,
  },
});
