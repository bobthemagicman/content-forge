import { App } from "aws-cdk-lib";
import { APP_ORIGIN, GOOGLE_PROVIDER_NAME, LOCAL_ORIGIN } from "../../../amplify/config";
import { AuthStack, type AuthEnv } from "../lib/auth-stack";

// The user pools, in the auth account (research R21). Deploy with scripts/auth/deploy.sh, which also
// hands the pool's settings to the app account (quickstart §2):
//   ALLOWED_EMAIL_DOMAIN=<domain> scripts/auth/deploy.sh --env dev --auth-profile <p> --app-profile <p>
const app = new App();

const authEnv = app.node.tryGetContext("env") as string | undefined;
if (authEnv !== "dev" && authEnv !== "prod") {
  throw new Error("auth: pass -c env=dev (personal sandboxes) or -c env=prod (master).");
}

// No example.com fallback here: a pool for the placeholder domain would admit nobody.
const allowedEmailDomain = process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase();
if (!allowedEmailDomain) throw new Error("auth: set ALLOWED_EMAIL_DOMAIN to the Workspace domain.");
if (authEnv === "prod" && !process.env.APP_ORIGIN) throw new Error("auth: set APP_ORIGIN for prod.");

// deploy.sh sets AUTH_REGION; otherwise the profile's region.
const region = process.env.AUTH_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error("auth: set AUTH_REGION, or a region on the AWS profile.");

new AuthStack(app, `ContentForgeAuth-${authEnv}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
  description: `Content Forge: Cognito user pool for ${authEnv === "prod" ? "production" : "personal sandboxes"}`,
  authEnv: authEnv satisfies AuthEnv,
  allowedEmailDomain,
  appOrigin: authEnv === "prod" ? APP_ORIGIN : LOCAL_ORIGIN,
  googleProviderName: GOOGLE_PROVIDER_NAME,
  googleSecretName: "content-forge/google-oauth-client",
});
