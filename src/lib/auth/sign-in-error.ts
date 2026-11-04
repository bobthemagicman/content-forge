/** Landing-page error codes (`/?error=<code>`), shown by the sign-in banner. */
export type SignInErrorCode = "domain" | "signin";

/**
 * Maps a failed OAuth redirect to the landing error. The pre-sign-up trigger's rejection reaches the
 * callback as `error_description=PreSignUp failed with error ONLY_ALLOWED_DOMAIN.` (research R3).
 */
export function signInErrorCode(message: string | null | undefined): SignInErrorCode {
  return message && /ONLY_ALLOWED_DOMAIN|PreSignUp/i.test(message) ? "domain" : "signin";
}
