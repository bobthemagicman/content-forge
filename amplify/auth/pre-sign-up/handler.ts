import type { PreSignUpTriggerHandler } from "aws-lambda";
import { env } from "$amplify/env/pre-sign-up";

/**
 * Rejects every account outside the allowed Google Workspace domain, for every trigger source
 * (research R3, FR-001/002). Cognito redirects to the callback with the message in
 * `error_description`, which the callback page maps to "authorized accounts only".
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  const domain = env.ALLOW_DOMAIN?.toLowerCase();
  // Fail closed: a missing setting must never mean "any domain".
  if (!domain) throw new Error("ONLY_ALLOWED_DOMAIN");

  const email = event.request.userAttributes.email?.toLowerCase() ?? "";
  if (!email.endsWith(`@${domain}`)) throw new Error("ONLY_ALLOWED_DOMAIN");

  return event;
};
