/**
 * The deployment environment name (research R19).
 *
 * It names the SSM parameters (`/content-forge/<env>/...`), including the signing keys, so it must
 * be a single path segment.
 * `scripts/bootstrap/create-signing-keys.sh` accepts exactly the same names;
 * tests/unit/environment.test.ts keeps the two patterns in step.
 */
export const ENV_NAME_PATTERN = /^(master|sandbox-[A-Za-z0-9._-]+)$/;

/**
 * `AWS_BRANCH` on Amplify Hosting, otherwise `sandbox-<OS username>` for a personal `ampx sandbox`.
 * Throws for a name the key script can't bootstrap, such as a branch with a `/`.
 */
export function resolveEnvName(awsBranch: string | undefined, username: string): string {
  const envName = awsBranch ?? `sandbox-${username}`;
  if (!ENV_NAME_PATTERN.test(envName)) {
    const fix = awsBranch
      ? "Only the master branch deploys; connect no other branch to the Amplify app."
      : "Run the sandbox with AWS_BRANCH=sandbox-<name> set, using letters, digits, '.', '_' or '-'.";
    throw new Error(`Environment "${envName}" must be master or sandbox-<name> (research R19). ${fix}`);
  }
  return envName;
}
