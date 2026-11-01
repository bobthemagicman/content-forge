// Turns the demo catalog into what the data API will return, including the asset keys the
// generated demo art lives under (public/demo/v/<id>/...).

import { capLuminance } from "@/lib/color";
import type { ContentItem, PowerPointMeta } from "@/lib/data/types";
import { DEMO_ITEMS, type DemoArt, type DemoItem } from "./catalog";

/** The color ingest would read as the thumbnail's dominant color (`sharp().stats().dominant`). */
function dominantColor(art: DemoArt): string | undefined {
  switch (art.kind) {
    case "web":
    case "ppt":
    case "image":
      return art.bg;
    case "video":
      return art.sky;
    case "texture":
      return art.base;
    case "other":
      return undefined;
  }
}

function toContentItem({ art, ...item }: DemoItem): ContentItem {
  const base = `v/${item.id}`;
  const dominant = dominantColor(art);
  const result: ContentItem = {
    ...item,
    thumbKeys: art.kind === "other" ? {} : { "320": `${base}/thumb.svg` },
    accentColor: dominant ? capLuminance(dominant) : undefined,
  };
  switch (art.kind) {
    case "web":
      result.previewKeys = [`${base}/desktop.svg`, `${base}/mobile.svg`];
      break;
    case "ppt": {
      const count = Math.min(12, (item.meta as PowerPointMeta).slideCount);
      result.previewKeys = Array.from({ length: count }, (_, i) => `${base}/slide-${String(i + 1).padStart(2, "0")}.svg`);
      break;
    }
    case "video":
      result.posterKey = `${base}/poster.svg`;
      result.videoPreviewKey = `${base}/preview.mp4`;
      break;
    case "image":
      result.previewKeys = [`${base}/preview.svg`];
      break;
    case "texture":
      result.previewKeys = [`${base}/tile.svg`];
      break;
  }
  return result;
}

export const DEMO_CONTENT: ContentItem[] = DEMO_ITEMS.map(toContentItem);
