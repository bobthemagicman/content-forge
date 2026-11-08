import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The user pool this deployment signs users in with. It lives in the auth account, deployed by
 * infra/auth (research R21), which this backend can't read across accounts. So
 * scripts/auth/deploy.sh writes its outputs to `amplify/auth-environments/<dev|prod>.json`, which
 * is committed. None of it is secret: the same values ship in the front end's bundle.
 */
export interface AuthEnvironment {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  /** The Cognito domain, `<prefix>.auth.<region>.amazoncognito.com`. */
  domain: string;
  /** The only origin the app client may redirect to. */
  appOrigin: string;
  /** The pool's token issuer, which AppSync's OIDC mode trusts. */
  issuerUrl: string;
}

/** `prod` for `master`, `dev` (on localhost, shared by every sandbox) otherwise. */
export function authEnvFor(envName: string): "dev" | "prod" {
  return envName === "master" ? "prod" : "dev";
}

const PATTERNS: Record<Exclude<keyof AuthEnvironment, "issuerUrl">, RegExp> = {
  region: /^[a-z]{2}(-[a-z]+)+-\d$/,
  userPoolId: /^[a-z]{2}(-[a-z]+)+-\d_[A-Za-z0-9]+$/,
  userPoolClientId: /^[a-z0-9]{1,128}$/,
  domain: /^[a-z0-9-]+\.auth\.[a-z]{2}(-[a-z]+)+-\d\.amazoncognito\.com$/,
  appOrigin: /^https?:\/\/[^/]+$/,
};

/**
 * Reads and checks the handover file. `CONTENT_FORGE_AUTH_FILE` overrides the path, for tests.
 */
export function loadAuthEnvironment(authEnv: "dev" | "prod"): AuthEnvironment {
  const path =
    process.env.CONTENT_FORGE_AUTH_FILE ??
    fileURLToPath(new URL(`./auth-environments/${authEnv}.json`, import.meta.url));
  if (!existsSync(path)) {
    throw new Error(
      `No user pool for auth environment "${authEnv}" (${path}). Deploy it to the auth account with ` +
        `scripts/auth/deploy.sh --env ${authEnv} --profile <profile>, then commit the file (quickstart §2).`,
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  for (const [key, pattern] of Object.entries(PATTERNS)) {
    const value = raw[key];
    if (typeof value !== "string" || !pattern.test(value)) {
      throw new Error(`${path}: "${key}" is missing or malformed.`);
    }
  }
  const env = raw as unknown as Omit<AuthEnvironment, "issuerUrl">;
  if (!env.userPoolId.startsWith(`${env.region}_`)) {
    throw new Error(`${path}: userPoolId isn't in region ${env.region}.`);
  }
  return { ...env, issuerUrl: `https://cognito-idp.${env.region}.amazonaws.com/${env.userPoolId}` };
}
