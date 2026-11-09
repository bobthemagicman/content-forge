// Build-time settings. NEXT_PUBLIC_* values are inlined into the static bundle, so nothing secret
// belongs here (Principle II).

import outputs from "@/../amplify_outputs.json";

/**
 * Beta preview mode: a built-in demo catalog stands in for the Amplify backend, and sign-in is
 * simulated. `NEXT_PUBLIC_DEMO_MODE=0` switches sign-in to Cognito (T035); the catalog follows once
 * the data tasks land.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "0";

/**
 * Where viewable assets (thumbnails, previews, demos) and `/_session` are served from. The beta
 * preview serves its generated demo assets from the site itself. Every other build takes the asset
 * host from its backend's outputs (`custom.assetsBaseUrl`, contracts/assets-cdn.md), and fails
 * without one rather than pointing images at the app's own host.
 */
export function resolveAssetsBaseUrl(demoMode: boolean, backendOutputs: unknown): string {
  if (demoMode) return "/demo";
  const url = (backendOutputs as { custom?: { assetsBaseUrl?: unknown } }).custom?.assetsBaseUrl;
  if (typeof url !== "string" || !/^https:\/\/[^/]+\/?$/.test(url)) {
    throw new Error("amplify_outputs.json has no custom.assetsBaseUrl (an https origin); deploy the backend first.");
  }
  return url.replace(/\/$/, "");
}

export const ASSETS_BASE_URL = resolveAssetsBaseUrl(DEMO_MODE, outputs);
