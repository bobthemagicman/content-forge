import { describe, expect, it } from "vitest";
import { capLuminance, hexToRgb, relativeLuminance, rgbTriple } from "@/lib/color";

describe("capLuminance", () => {
  it.each(["#FFFFFF", "#F2C14E", "#AFFC41", "#FFE3B3"])("darkens %s to luminance 0.2 or less", (hex) => {
    const capped = capLuminance(hex);
    expect(relativeLuminance(hexToRgb(capped))).toBeLessThanOrEqual(0.2);
    // Not crushed to black: stays close to the cap.
    expect(relativeLuminance(hexToRgb(capped))).toBeGreaterThan(0.15);
  });

  it("keeps the hue", () => {
    const [r, g, b] = hexToRgb(capLuminance("#F2C14E"));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it("leaves dark colors unchanged", () => {
    expect(capLuminance("#3C1642")).toBe("#3C1642");
  });

  it("formats an RGB triple for CSS", () => {
    expect(rgbTriple("#AFFC41")).toBe("175 252 65");
  });
});
