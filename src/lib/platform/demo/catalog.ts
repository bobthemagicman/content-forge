// The beta preview's catalog adapter: the built-in demo catalog, with simulated latency so loading
// states show the way they will against a real API (T135).

import type { CatalogClient } from "@/lib/platform/catalog";
import { DEMO_CONTENT } from "@/lib/data/demo/source";
import { DownloadError, type ContentItem, type ContentSummary } from "@/lib/data/types";

function latency(ms = 250 + Math.random() * 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSummary({ id, slug, title, type, thumbKeys }: ContentItem): ContentSummary {
  return { id, slug, title, type, thumbKeys };
}

export function createDemoCatalog(): CatalogClient {
  return {
    async listRow(type, { limit = 20, nextToken = null } = {}) {
      await latency();
      const all = DEMO_CONTENT.filter((c) => c.type === type && c.status === "PUBLISHED" && c.publishedAt).sort((a, b) =>
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
      );
      const start = nextToken ? Number(nextToken) : 0;
      const end = start + limit;
      return { items: all.slice(start, end).map(toSummary), nextToken: end < all.length ? String(end) : null };
    },

    async getBySlug(slug) {
      await latency();
      const matches = DEMO_CONTENT.filter((c) => c.slug === slug);
      if (matches.length > 1) console.warn(`getBySlug: ${matches.length} items share the slug "${slug}"`);
      const item = matches[0];
      return item && item.status === "PUBLISHED" ? item : null;
    },

    // The beta preview has no files to download.
    async requestDownloadUrl(contentId) {
      await latency(600);
      if (!DEMO_CONTENT.some((c) => c.id === contentId)) throw new DownloadError("NotFound");
      throw new DownloadError("BetaPreview");
    },
  };
}
