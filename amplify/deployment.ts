import { userInfo } from "node:os";
import { authEnvFor, loadAuthEnvironment } from "./auth-environment";
import { APP_ORIGIN, LOCAL_ORIGIN } from "./config";
import { resolveEnvName } from "./environment";

// What this synth deploys, resolved once for backend.ts and the resources (research R19, R21).

/** Amplify Hosting sets AWS_BRANCH; a personal `ampx sandbox` doesn't. */
export const envName = resolveEnvName(process.env.AWS_BRANCH, userInfo().username);
export const isProduction = envName === "master";

// The domain settings default to `example.com` placeholders so the real domain stays out of this
// repo. Production must set them: a placeholder deploy would fail closed, but confusingly.
if (isProduction) {
  const missing = ["ALLOWED_EMAIL_DOMAIN", "APP_ORIGIN", "ASSETS_DOMAIN"].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Production needs ${missing.join(", ")} set on the Amplify app (quickstart §2).`);
  }
}

/** The user pool in the auth account: `prod` for master, the shared `dev` pool for sandboxes. */
export const authEnvironment = loadAuthEnvironment(authEnvFor(envName));

// The app client only redirects to one origin. A mismatch would deploy fine and then fail every
// sign-in with Cognito's redirect_mismatch, so catch it here.
const expectedOrigin = isProduction ? APP_ORIGIN : LOCAL_ORIGIN;
if (authEnvironment.appOrigin !== expectedOrigin) {
  throw new Error(
    `The ${authEnvFor(envName)} user pool redirects to ${authEnvironment.appOrigin}, but this deployment ` +
      `serves ${expectedOrigin}. Redeploy the pool with the right APP_ORIGIN (quickstart §2).`,
  );
}
