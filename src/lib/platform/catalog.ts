// The browser's catalog port (T135, specs/003-portable-deployment/plan.md "Ports"): the three reads
// the UI makes (contracts/data-api.md). `src/lib/data/content.ts` re-exports them from this
// deployment's adapter, so pages don't know which one answers.

import type { ContentType } from "@/lib/content-types";
import type { ContentItem, ContentSummary, Page } from "@/lib/data/types";
import { createDemoCatalog } from "./demo/catalog";

export interface CatalogClient {
  /** One page of a browse row: published items of `type`, newest first (data-api §1). */
  listRow(type: ContentType, options?: { limit?: number; nextToken?: string | null }): Promise<Page<ContentSummary>>;
  /** The published item with this slug, or null when it's missing or a draft (data-api §2). */
  getBySlug(slug: string): Promise<ContentItem | null>;
  /** A 5-minute signed download URL. Rejects with a `DownloadError` (data-api §3). */
  requestDownloadUrl(contentId: string): Promise<{ url: string; expiresAt: string }>;
}

let client: CatalogClient | undefined;

/**
 * This deployment's adapter, created on first use. Every build uses the demo catalog until the
 * AppSync adapter exists: T084 and T096 add it in `./aws/catalog.ts` and pick it here when
 * DEMO_MODE is off and `PLATFORM_CONFIG.catalog.kind` is "appsync".
 */
export function catalogClient(): CatalogClient {
  client ??= createDemoCatalog();
  return client;
}
