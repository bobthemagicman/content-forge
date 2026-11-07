// Deployment settings read at synth time. `example.com` is a placeholder for the owner's domain,
// set per deployment through these variables (spec.md Assumptions), so the real domain stays out of
// this public repo.

/** The Google Workspace domain whose accounts may sign in (FR-001). */
export const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "example.com").toLowerCase();

/** The production app origin, `https://content.<domain>` (research R3). */
export const APP_ORIGIN = (process.env.APP_ORIGIN ?? "https://content.example.com").replace(/\/$/, "");

/** Where `next dev` runs in a personal sandbox (research R19). */
export const LOCAL_ORIGIN = "http://localhost:3000";
