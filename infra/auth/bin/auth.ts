import { App } from "aws-cdk-lib";
import { APP_ORIGIN, GOOGLE_PROVIDER_NAME, LOCAL_ORIGIN } from "../../../amplify/config";
import { AuthStack, type AuthEnv } from "../lib/auth-stack";

// The user pools, in the auth account (research R21). Deploy with scripts/auth/deploy.sh, which also
// writes the handover file the app's backend reads (quickstart §2):
//   ALLOWED_EMAIL_DOMAIN=<domain> scripts/auth/deploy.sh --env dev --profile <auth account profile>
const app = new App();

const authEnv = app.node.tryGetContext("env") as string | undefined;
if (authEnv !== "dev" && authEnv !== "prod") {
  throw new Error("auth: pass -c env=dev (personal sandboxes) or -c env=prod (master).");
}

// No example.com fallback here: a pool for the placeholder domain would admit nobody.
const allowedEmailDomain = process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase();
if (!allowedEmailDomain) throw new Error("auth: set ALLOWED_EMAIL_DOMAIN to the Workspace domain.");
if (authEnv === "prod" && !process.env.APP_ORIGIN) throw new Error("auth: set APP_ORIGIN for prod.");

new AuthStack(app, `ContentForgeAuth-${authEnv}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-west-2" },
  description: `Content Forge: Cognito user pool for ${authEnv === "prod" ? "production" : "personal sandboxes"}`,
  authEnv: authEnv satisfies AuthEnv,
  allowedEmailDomain,
  appOrigin: authEnv === "prod" ? APP_ORIGIN : LOCAL_ORIGIN,
  googleProviderName: GOOGLE_PROVIDER_NAME,
  googleSecretName: "content-forge/google-oauth-client",
});
