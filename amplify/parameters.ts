import { createSsmSettings } from "./lib/platform/aws/ssm-settings";
import { createDirectorySettings } from "./lib/platform/directory-settings";
import { SettingNotFoundError } from "./lib/platform/ports";

// Deployment settings that differ per deployment and so stay out of this public repo
// (docs/deployment/settings.md). Bootstrap scripts write them to SSM in the app account, and synth
// reads them from there with the deploying credentials. The synthesized templates hold the values,
// but they stay in cdk.out and the deploying account.

/** The SSM parameter names this backend reads at synth. */
export const PARAMETERS = {
  /** The user pool in the auth account, as JSON (scripts/auth/deploy.sh, research R21). */
  authEnvironment: (authEnv: "dev" | "prod") => `/content-forge/auth/${authEnv}`,
  /** This environment's CloudFront public key, PEM (scripts/bootstrap/create-signing-keys.sh). */
  signingPublicKey: (envName: string) => `/content-forge/${envName}/cloudfront/public-key`,
};

/**
 * One deployment parameter, or undefined if it's missing or empty, through the SettingsStore port
 * (T136). With `CONTENT_FORGE_PARAMETERS_DIR` set, it reads the file `<dir>/<name>` instead: tests
 * use that, and so can a synth without AWS access.
 */
export async function readDeploymentParameter(name: string): Promise<string | undefined> {
  const dir = process.env.CONTENT_FORGE_PARAMETERS_DIR;
  const store = dir ? createDirectorySettings(dir) : createSsmSettings();
  try {
    return await store.get(name);
  } catch (error) {
    if (error instanceof SettingNotFoundError) return undefined;
    if (dir) throw error;
    throw new Error(
      `Couldn't read the SSM parameter ${name} with the deploying credentials: ${(error as Error).message}`,
      { cause: error },
    );
  }
}
