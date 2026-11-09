import { describe, expect, it } from "vitest";
import outputs from "../e2e/fixtures/amplify_outputs.e2e.json";
import { resolveAssetsBaseUrl } from "@/lib/config";

describe("resolveAssetsBaseUrl", () => {
  it("serves the beta preview's assets from the site itself", () => {
    expect(resolveAssetsBaseUrl(true, {})).toBe("/demo");
  });

  it("takes the asset host from the backend outputs otherwise", () => {
    expect(resolveAssetsBaseUrl(false, outputs)).toBe("https://assets.e2e.test");
    expect(resolveAssetsBaseUrl(false, { custom: { assetsBaseUrl: "https://d111.cloudfront.net/" } })).toBe(
      "https://d111.cloudfront.net",
    );
  });

  it.each([
    ["no custom outputs", {}],
    ["plain HTTP", { custom: { assetsBaseUrl: "http://assets.example.com" } }],
    ["a path", { custom: { assetsBaseUrl: "https://assets.example.com/v" } }],
    ["the app's own host", { custom: { assetsBaseUrl: "/demo" } }],
  ])("refuses %s outside the beta preview", (_, value) => {
    expect(() => resolveAssetsBaseUrl(false, value)).toThrow(/custom\.assetsBaseUrl/);
  });
});
