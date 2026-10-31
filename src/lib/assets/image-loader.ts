"use client";

import { assetUrl } from "./asset-url";

const WIDTHS = [320, 640, 1280] as const;
const THUMB_WIDTH = /thumb-(320|640|1280)\./;

/**
 * `next/image` loader for catalog assets (research R13). `src` is an asset key. Thumbnail keys
 * (`v/<id>/thumb-320.<hash>.webp`) get the smallest generated width that covers the request, or
 * the largest; other keys (gallery images, vector demo art) are served as-is.
 */
export default function imageLoader({ src, width }: { src: string; width: number }): string {
  if (/^(https?:)?\/\//.test(src)) return src;
  const key = THUMB_WIDTH.test(src)
    ? src.replace(THUMB_WIDTH, `thumb-${WIDTHS.find((w) => w >= width) ?? WIDTHS[WIDTHS.length - 1]}.`)
    : src;
  return assetUrl(key);
}
