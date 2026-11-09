import type { Claims } from "./ports";

/**
 * Whether verified claims belong to a member of the allowed Google Workspace (contracts/assets-cdn.md,
 * Principle II): a verified address in `allowedDomain`, and that domain as the account's hosted
 * domain. Only Workspace accounts have a hosted domain, so this refuses a consumer Google account
 * using a company address. `hostedDomainClaim` is where the broker puts Google's `hd` (Cognito maps
 * it to `custom:hd`, infra/auth/lib/auth-stack.ts).
 */
export function isWorkspaceMember(claims: Claims, allowedDomain: string, hostedDomainClaim: string): boolean {
  const domain = allowedDomain.toLowerCase();
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  // Typed as a boolean, but federated identities can carry it as the string "false".
  const unverified = claims.email_verified === false || claims.email_verified === "false";
  const hostedDomain = claims[hostedDomainClaim];
  const inWorkspace = typeof hostedDomain === "string" && hostedDomain.toLowerCase() === domain;
  return email.endsWith(`@${domain}`) && !unverified && inWorkspace;
}
