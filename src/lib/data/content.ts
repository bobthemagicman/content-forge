// Catalog reads for the UI (contracts/data-api.md). The beta preview answers from the built-in demo
// catalog; T084/T096 add the AppSync implementation behind these same functions.

import type { ContentType } from "@/lib/content-types";
import { DEMO_CONTENT } from "./demo/source";
import { DownloadError, type ContentItem, type ContentSummary, type Page } from "./types";

/** Simulated network latency, so loading states show the way they will against the real API. */
function latency(ms = 250 + Math.random() * 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSummary({ id, slug, title, type, thumbKeys }: ContentItem): ContentSummary {
  return { id, slug, title, type, thumbKeys };
}

/** One page of a browse row: published items of `type`, newest first (data-api §1). */
export async function listRow(
  type: ContentType,
  { limit = 20, nextToken = null }: { limit?: number; nextToken?: string | null } = {},
): Promise<Page<ContentSummary>> {
  await latency();
  const all = DEMO_CONTENT.filter((c) => c.type === type && c.status === "PUBLISHED" && c.publishedAt).sort(
    (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
  const start = nextToken ? Number(nextToken) : 0;
  const end = start + limit;
  return { items: all.slice(start, end).map(toSummary), nextToken: end < all.length ? String(end) : null };
}

/** The published item with this slug, or null when it's missing or a draft (data-api §2). */
export async function getBySlug(slug: string): Promise<ContentItem | null> {
  await latency();
  const matches = DEMO_CONTENT.filter((c) => c.slug === slug);
  if (matches.length > 1) console.warn(`getBySlug: ${matches.length} items share the slug "${slug}"`);
  const item = matches[0];
  return item && item.status === "PUBLISHED" ? item : null;
}

/** A 5-minute signed download URL (data-api §3). The beta preview has no files to download. */
export async function requestDownloadUrl(contentId: string): Promise<{ url: string; expiresAt: string }> {
  await latency(600);
  if (!DEMO_CONTENT.some((c) => c.id === contentId)) throw new DownloadError("NotFound");
  throw new DownloadError("BetaPreview");
}
