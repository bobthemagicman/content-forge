import { describe, expect, it } from "vitest";
import twin from "../e2e/fixtures/platform-config.e2e.json";
import { resolveAssetsBaseUrl } from "@/lib/config";
import { parsePlatformConfig } from "@/lib/platform/config";

describe("resolveAssetsBaseUrl", () => {
  const config = parsePlatformConfig(twin);

  it("serves the beta preview's assets from the site itself", () => {
    expect(resolveAssetsBaseUrl(true, config)).toBe("/demo");
  });

  it("uses the deployment's asset host otherwise", () => {
    expect(resolveAssetsBaseUrl(false, config)).toBe("https://assets.e2e.test");
  });
});
