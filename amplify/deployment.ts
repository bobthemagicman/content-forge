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
  const missing = ["APP_ORIGIN", "ASSETS_DOMAIN"].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Production needs ${missing.join(", ")} set on the Amplify app (quickstart §2).`);
  }
}

/** The user pool in the auth account: `prod` for master, the shared `dev` pool for sandboxes. */
export const authEnvironment = await loadAuthEnvironment(authEnvFor(envName));

// The app client only redirects to one origin. A mismatch would deploy fine and then fail every
// sign-in with Cognito's redirect_mismatch, so catch it here.
const expectedOrigin = isProduction ? APP_ORIGIN : LOCAL_ORIGIN;
if (authEnvironment.appOrigin !== expectedOrigin) {
  throw new Error(
    `The ${authEnvFor(envName)} user pool redirects to ${authEnvironment.appOrigin}, but this deployment ` +
      `serves ${expectedOrigin}. Redeploy the pool with the right APP_ORIGIN, or check that this deployment reads its own account's SSM (quickstart §2).`,
  );
}

// The allowed email domain comes from the pool's settings (its pre-sign-up trigger's domain). The
// ALLOWED_EMAIL_DOMAIN variable is only read by scripts/auth/deploy.sh now; a leftover one that
// disagrees would be a silent misconfiguration, so stop.
const legacyDomain = process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase();
if (legacyDomain && legacyDomain !== authEnvironment.allowedEmailDomain) {
  throw new Error(
    `ALLOWED_EMAIL_DOMAIN is set, but the ${authEnvFor(envName)} user pool allows a different domain. ` +
      `The backend uses the pool's domain: unset ALLOWED_EMAIL_DOMAIN, or redeploy the pool with scripts/auth/deploy.sh.`,
  );
}
