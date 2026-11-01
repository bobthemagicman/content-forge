// Build-time settings. NEXT_PUBLIC_* values are inlined into the static bundle, so nothing secret
// belongs here (Principle II).

/**
 * Where viewable assets (thumbnails, previews, demos) are served from. The real value comes from
 * amplify_outputs.json (`custom.assetsBaseUrl`) once the asset plane exists (T030). The beta
 * preview serves its generated demo assets from the site itself.
 */
export const ASSETS_BASE_URL = (process.env.NEXT_PUBLIC_ASSETS_BASE_URL ?? "/demo").replace(/\/$/, "");

/**
 * Beta preview mode: a built-in demo catalog stands in for the Amplify backend, and sign-in is
 * simulated. On until the backend tasks (T014–T025) land.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "0";
