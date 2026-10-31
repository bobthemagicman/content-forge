import { describe, expect, it } from "vitest";
import { demoUrl } from "@/lib/assets/asset-url";
import imageLoader from "@/lib/assets/image-loader";
import { ASSETS_BASE_URL } from "@/lib/config";

const key = "v/abc/thumb-320.1a2b3c4d.webp";

describe("imageLoader", () => {
  it.each([
    [100, "thumb-320."],
    [320, "thumb-320."],
    [321, "thumb-640."],
    [1280, "thumb-1280."],
    [2000, "thumb-1280."],
  ])("picks the smallest thumbnail that covers %ipx", (width, segment) => {
    expect(imageLoader({ src: key, width })).toContain(segment);
  });

  it("prefixes the assets base URL", () => {
    expect(imageLoader({ src: key, width: 640 })).toBe(`${ASSETS_BASE_URL}/v/abc/thumb-640.1a2b3c4d.webp`);
  });

  it("leaves non-thumbnail keys alone", () => {
    expect(imageLoader({ src: "v/abc/preview-1.1a2b3c4d.webp", width: 2000 })).toBe(
      `${ASSETS_BASE_URL}/v/abc/preview-1.1a2b3c4d.webp`,
    );
  });
});

describe("demoUrl", () => {
  it("builds the hosted demo URL and encodes each segment", () => {
    expect(demoUrl({ id: "abc", demoEntryPath: "site files/index.html" })).toBe(
      `${ASSETS_BASE_URL}/v/abc/demo/site%20files/index.html`,
    );
  });

  it.each(["../secret.html", "a/../../b.html", "/index.html", "./index.html"])("refuses %s", (path) => {
    expect(demoUrl({ id: "abc", demoEntryPath: path })).toBeNull();
  });

  it("is null without a demo", () => {
    expect(demoUrl({ id: "abc" })).toBeNull();
  });
});
