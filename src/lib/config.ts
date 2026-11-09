// Build-time settings. NEXT_PUBLIC_* values and platform-config.json are inlined into the static
// bundle, so nothing secret belongs here (Principle II).

import rawPlatformConfig from "@/../platform-config.json";
import { type PlatformConfig, parsePlatformConfig } from "@/lib/platform/config";

/**
 * Beta preview mode: a built-in demo catalog stands in for the backend, and sign-in is simulated.
 * `NEXT_PUBLIC_DEMO_MODE=0` switches sign-in to the deployment's broker (T035); the catalog follows
 * once the data tasks land.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "0";

/**
 * This deployment's provider settings (T132). Validated here, at build time, so a bad file fails
 * the build instead of shipping a front end pointed at nothing.
 */
export const PLATFORM_CONFIG: PlatformConfig = parsePlatformConfig(rawPlatformConfig);

/**
 * Where viewable assets (thumbnails, previews, demos) and `/_session` are served from. The beta
 * preview serves its generated demo assets from the site itself; every other build uses the
 * deployment's asset host (contracts/assets-cdn.md).
 */
export function resolveAssetsBaseUrl(demoMode: boolean, config: PlatformConfig): string {
  return demoMode ? "/demo" : config.assets.baseUrl;
}

export const ASSETS_BASE_URL = resolveAssetsBaseUrl(DEMO_MODE, PLATFORM_CONFIG);
