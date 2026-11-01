import { ASSETS_BASE_URL } from "@/lib/config";
import type { ContentItem } from "@/lib/data/types";

/** Absolute URL of a viewable asset key (`v/...`). */
export function assetUrl(key: string): string {
  return `${ASSETS_BASE_URL}/${key.replace(/^\//, "")}`;
}

/**
 * Hosted live demo URL for a website template, or null when it has none. Each path segment is
 * encoded, and traversal is refused (FR-034).
 */
export function demoUrl(item: Pick<ContentItem, "id" | "demoEntryPath">): string | null {
  if (!item.demoEntryPath) return null;
  const segments = item.demoEntryPath.split("/");
  if (segments.some((s) => s === ".." || s === ".") || item.demoEntryPath.startsWith("/")) return null;
  return assetUrl(`v/${encodeURIComponent(item.id)}/demo/${segments.map(encodeURIComponent).join("/")}`);
}
