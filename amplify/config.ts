// Deployment settings read at synth time. `example.com` is a placeholder for the owner's domain,
// set per deployment through these variables (spec.md Assumptions), so the real domain stays out of
// this public repo.

/** The production app origin, `https://content.<domain>` (research R3). */
export const APP_ORIGIN = (process.env.APP_ORIGIN ?? "https://content.example.com").replace(/\/$/, "");

/**
 * The Cognito identity provider name for Google Workspace (an OIDC provider, research R3). The app
 * passes the same name to `signInWithRedirect` (`src/lib/auth/auth-provider.tsx`); a test keeps
 * the two in step.
 */
export const GOOGLE_PROVIDER_NAME = "GoogleWorkspace";

/**
 * The cost allocation tag on every resource this backend creates. The budget counts only spending
 * with this tag, because the app account may run other things (research R17). Activate it once
 * under Billing → Cost allocation tags (quickstart §2), or the budget sees nothing.
 */
export const COST_TAG = { key: "project", value: "content-forge" } as const;

/** Where `next dev` runs in a personal sandbox (research R19). */
export const LOCAL_ORIGIN = "http://localhost:3000";

/** The production asset host, `assets.<domain>`, served by CloudFront (research R6, R10). */
export const ASSETS_DOMAIN = (process.env.ASSETS_DOMAIN ?? "assets.example.com").toLowerCase();

/** The Route 53 zone that holds `ASSETS_DOMAIN`. Defaults to its parent domain. */
export const HOSTED_ZONE_NAME = (process.env.HOSTED_ZONE_NAME ?? ASSETS_DOMAIN.split(".").slice(1).join(".")).toLowerCase();
