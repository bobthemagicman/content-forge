import { PARAMETERS, readDeploymentParameter } from "./parameters";

/**
 * The user pool this deployment signs users in with. It lives in the auth account, deployed by
 * infra/auth (research R21), which this backend can't read across accounts. So
 * scripts/auth/deploy.sh copies its outputs to the SSM parameter `/content-forge/auth/<dev|prod>`
 * in the app account. None of it is secret (the front end's bundle ships the same values), but it
 * identifies one deployment, so it stays out of the repo (docs/deployment/settings.md).
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

/** Checks the handover JSON and derives the token issuer. `source` names it in errors. */
export function parseAuthEnvironment(json: string, source: string): AuthEnvironment {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(`${source}: not valid JSON.`);
  }
  for (const [key, pattern] of Object.entries(PATTERNS)) {
    const value = raw[key];
    if (typeof value !== "string" || !pattern.test(value)) {
      throw new Error(`${source}: "${key}" is missing or malformed.`);
    }
  }
  const env = raw as unknown as Omit<AuthEnvironment, "issuerUrl">;
  if (!env.userPoolId.startsWith(`${env.region}_`)) {
    throw new Error(`${source}: userPoolId isn't in region ${env.region}.`);
  }
  const { region, userPoolId, userPoolClientId, domain, appOrigin } = env;
  return {
    region,
    userPoolId,
    userPoolClientId,
    domain,
    appOrigin,
    issuerUrl: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  };
}

/** Reads and checks the handover for `authEnv` from the app account's SSM. */
export async function loadAuthEnvironment(authEnv: "dev" | "prod"): Promise<AuthEnvironment> {
  const name = PARAMETERS.authEnvironment(authEnv);
  const json = await readDeploymentParameter(name);
  if (json === undefined) {
    throw new Error(
      `No user pool for auth environment "${authEnv}": the SSM parameter ${name} doesn't exist in this ` +
        `account and region. Deploy the pool with scripts/auth/deploy.sh --env ${authEnv} ` +
        `--auth-profile <auth account> --app-profile <this account> (quickstart §2).`,
    );
  }
  return parseAuthEnvironment(json, name);
}
