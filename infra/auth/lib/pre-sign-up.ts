import type { PreSignUpTriggerHandler } from "aws-lambda";

/**
 * The user pool's pre-sign-up trigger (lib/auth-stack.ts). Admits only Google Workspace accounts in
 * the allowed domain (research R3, FR-001/002). Every check fails closed. Cognito redirects to the
 * callback with the message in `error_description`, which the callback page maps to "authorized
 * accounts only".
 *
 * - Accounts come only from federated sign-in: any other trigger source is refused.
 * - `custom:hd` is Google's hosted-domain claim. Only Workspace accounts carry it, so a consumer
 *   Google account using an address in the domain is refused, as Google recommends.
 * - The email must be in the domain too, and verified.
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  const domain = process.env.ALLOW_DOMAIN?.toLowerCase();
  // A missing setting must never mean "any domain".
  if (!domain) throw new Error("ONLY_ALLOWED_DOMAIN");
  if (event.triggerSource !== "PreSignUp_ExternalProvider") throw new Error("ONLY_ALLOWED_DOMAIN");

  const attributes = event.request.userAttributes;
  const hostedDomain = attributes["custom:hd"]?.toLowerCase();
  const email = attributes.email?.toLowerCase() ?? "";
  if (hostedDomain !== domain || !email.endsWith(`@${domain}`) || attributes.email_verified === "false") {
    throw new Error("ONLY_ALLOWED_DOMAIN");
  }

  return event;
};
