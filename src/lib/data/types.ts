import type { ContentType, LicenseType } from "@/lib/content-types";

/** Thumbnail keys by width (data-model `thumbKeys`). */
export type ThumbKeys = Partial<Record<"320" | "640" | "1280", string>>;

export interface WebsiteTemplateMeta {
  pageCount: number;
  demoVariants?: string[];
}
export interface PowerPointMeta {
  slideCount: number;
  deckFileName: string;
  aspectRatio: string;
}
export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  codec: string;
  fps: number;
}
export interface ImageMeta {
  width: number;
  height: number;
  format: string;
}
export interface OtherMeta {
  fileList: { path: string; bytes: number }[];
  /** Total entries before the 500-entry cap, when the list was truncated. */
  totalFiles?: number;
}

export type ContentMeta = WebsiteTemplateMeta | PowerPointMeta | VideoMeta | ImageMeta | OtherMeta;

/** Fields a browse card needs (the row query's selection set). */
export interface ContentSummary {
  id: string;
  slug: string;
  title: string;
  type: ContentType;
  thumbKeys: ThumbKeys;
}

/** A published item as the detail page sees it (data-model "Entity: Content"). */
export interface ContentItem extends ContentSummary {
  status: "DRAFT" | "PUBLISHED";
  publishedAt?: string;
  description?: string;
  tags?: string[];
  sourceMarketplace?: string;
  sourceUrl?: string;
  externalDemoUrl?: string;
  licenseType: LicenseType;
  purchaseDate?: string;
  archiveFileName: string;
  archiveBytes: number;
  demoEntryPath?: string;
  accentColor?: string;
  previewKeys?: string[];
  videoPreviewKey?: string;
  posterKey?: string;
  meta?: ContentMeta;
  downloadCount: number;
}

export interface Page<T> {
  items: T[];
  nextToken: string | null;
}

/** `errorType` values from contracts/data-api.md §3, plus the beta preview's "no files" case. */
export type DownloadErrorType = "Unauthorized" | "NotFound" | "ArchiveMissing" | "InternalError" | "BetaPreview";

export class DownloadError extends Error {
  constructor(readonly errorType: DownloadErrorType) {
    super(errorType);
    this.name = "DownloadError";
  }
}
