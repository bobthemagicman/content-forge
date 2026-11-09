// Catalog reads for the UI (contracts/data-api.md), answered by this deployment's CatalogClient
// adapter (T135): the demo catalog today, AppSync once T084 and T096 land.

import type { ContentType } from "@/lib/content-types";
import { catalogClient } from "@/lib/platform/catalog";
import type { ContentItem, ContentSummary, Page } from "./types";

/** One page of a browse row: published items of `type`, newest first (data-api §1). */
export function listRow(
  type: ContentType,
  options: { limit?: number; nextToken?: string | null } = {},
): Promise<Page<ContentSummary>> {
  return catalogClient().listRow(type, options);
}

/** The published item with this slug, or null when it's missing or a draft (data-api §2). */
export function getBySlug(slug: string): Promise<ContentItem | null> {
  return catalogClient().getBySlug(slug);
}

/** A 5-minute signed download URL (data-api §3). Rejects with a `DownloadError`. */
export function requestDownloadUrl(contentId: string): Promise<{ url: string; expiresAt: string }> {
  return catalogClient().requestDownloadUrl(contentId);
}
