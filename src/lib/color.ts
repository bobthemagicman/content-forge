// Color helpers for the item glow (data-model `accentColor`, design-system pages/detail.md).

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a 6-digit hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Darkens a color (keeping its hue) until its relative luminance is at most `max`, so text over a
 * glow in that color stays AA. Colors already at or under the cap come back unchanged.
 */
export function capLuminance(hex: string, max = 0.2): string {
  let rgb = hexToRgb(hex);
  if (relativeLuminance(rgb) <= max) return rgbToHex(rgb);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const scaled = rgb.map((c) => Math.round(c * mid)) as Rgb;
    if (relativeLuminance(scaled) <= max) lo = mid;
    else hi = mid;
  }
  rgb = rgb.map((c) => Math.floor(c * lo)) as Rgb;
  return rgbToHex(rgb);
}

/** "R G B" triple for `rgb(var(--x) / alpha)` CSS. */
export function rgbTriple(hex: string): string {
  return hexToRgb(hex).join(" ");
}
