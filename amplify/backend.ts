import { defineBackend } from "@aws-amplify/backend";
import { ALLOWED_EMAIL_DOMAIN, APP_ORIGIN, ASSETS_DOMAIN, HOSTED_ZONE_NAME, LOCAL_ORIGIN } from "./config";
import { AssetsCdn } from "./custom/assets-cdn/construct";
import { data } from "./data/resource";
import { authEnvironment, envName, isProduction } from "./deployment";
import { PARAMETERS, readDeploymentParameter } from "./parameters";

// No `auth` resource: the user pool lives in the auth account (infra/auth, research R21), and this
// backend only trusts its tokens. The pool's settings (Google only, refresh-only client, no
// self-service sign-up) are in infra/auth/lib/auth-stack.ts.
const backend = defineBackend({ data });

// --- Asset plane (research R6–R8) -------------------------------------------------------------
const publicKeyParameter = PARAMETERS.signingPublicKey(envName);
const publicKeyPem = await readDeploymentParameter(publicKeyParameter);
if (!publicKeyPem?.includes("-----BEGIN PUBLIC KEY-----")) {
  throw new Error(
    `No CloudFront signing key for environment "${envName}" (SSM ${publicKeyParameter}). ` +
      `Run scripts/bootstrap/create-signing-keys.sh --env ${envName} --profile <this account>.`,
  );
}

const assets = new AssetsCdn(backend.createStack("assets"), "AssetsCdn", {
  envName,
  isProduction,
  publicKeyPem,
  userPoolId: authEnvironment.userPoolId,
  userPoolClientId: authEnvironment.userPoolClientId,
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
// The auth section Amplify would write for its own pool, so the front end configures Amplify
// unchanged (src/lib/auth/amplify-config.ts). No identity pool: the app never uses AWS credentials.
backend.addOutput({
  auth: {
    aws_region: authEnvironment.region,
    user_pool_id: authEnvironment.userPoolId,
    user_pool_client_id: authEnvironment.userPoolClientId,
    username_attributes: ["email"],
    standard_required_attributes: ["email"],
    user_verification_types: ["email"],
    mfa_configuration: "NONE",
    mfa_methods: [],
    groups: [],
    unauthenticated_identities_enabled: false,
    oauth: {
      identity_providers: [],
      domain: authEnvironment.domain,
      scopes: ["openid", "email", "profile"],
      redirect_sign_in_uri: [`${authEnvironment.appOrigin}/auth/callback/`],
      redirect_sign_out_uri: [`${authEnvironment.appOrigin}/`],
      response_type: "code",
    },
  },
});
backend.addOutput({
  custom: {
    assetsBaseUrl: assets.assetsBaseUrl,
    assetsBucketName: assets.bucket.bucketName,
    contentTableName: backend.data.resources.tables["Content"].tableName,
    region: backend.stack.region,
  },
});
