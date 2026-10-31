// Content types in row order, which is also the display order everywhere (FR-007, data-model).

export type ContentType =
  | "WEBSITE_TEMPLATE"
  | "POWERPOINT_TEMPLATE"
  | "VIDEO"
  | "IMAGE"
  | "TEXTURE"
  | "OTHER";

export type LicenseType = "REGULAR" | "EXTENDED" | "OTHER" | "UNKNOWN";

export type RouteSlug =
  | "website-templates"
  | "powerpoint-templates"
  | "video"
  | "images"
  | "textures"
  | "other";

export interface ContentTypeInfo {
  type: ContentType;
  /** Row and page title, e.g. "Website Templates". */
  label: string;
  /** Short name for header nav pills. */
  navLabel: string;
  /** Singular badge text on cards and detail pages. */
  badge: string;
  routeSlug: RouteSlug;
  /** DOM id of the row heading on /browse/, the target of jump links. */
  rowId: string;
}

export const CONTENT_TYPES: readonly ContentTypeInfo[] = [
  { type: "WEBSITE_TEMPLATE", label: "Website Templates", navLabel: "Website Templates", badge: "Website template", routeSlug: "website-templates" },
  { type: "POWERPOINT_TEMPLATE", label: "PowerPoint Templates", navLabel: "PowerPoint", badge: "PowerPoint", routeSlug: "powerpoint-templates" },
  { type: "VIDEO", label: "Video", navLabel: "Video", badge: "Video", routeSlug: "video" },
  { type: "IMAGE", label: "Images", navLabel: "Images", badge: "Image", routeSlug: "images" },
  { type: "TEXTURE", label: "Textures", navLabel: "Textures", badge: "Texture", routeSlug: "textures" },
  { type: "OTHER", label: "Other", navLabel: "Other", badge: "Other", routeSlug: "other" },
].map((t) => ({ ...t, type: t.type as ContentType, routeSlug: t.routeSlug as RouteSlug, rowId: `row-${t.routeSlug}` }));

const byType = new Map(CONTENT_TYPES.map((t) => [t.type, t]));
const bySlug = new Map(CONTENT_TYPES.map((t) => [t.routeSlug, t]));

export function typeInfo(type: ContentType): ContentTypeInfo {
  const info = byType.get(type);
  if (!info) throw new Error(`Unknown content type: ${type}`);
  return info;
}

export function typeFromRouteSlug(slug: string): ContentType | undefined {
  return bySlug.get(slug as RouteSlug)?.type;
}

export function labelFor(type: ContentType): string {
  return typeInfo(type).label;
}

/** 1-based position in row order, shown as the outlined index number ("01"). */
export function rowNumber(type: ContentType): string {
  return String(CONTENT_TYPES.findIndex((t) => t.type === type) + 1).padStart(2, "0");
}

/** Each type's accent as an "R G B" triple; mirrors the [data-type] selectors in globals.css. */
export const ACCENT_RGB: Record<ContentType, string> = {
  WEBSITE_TEMPLATE: "175 252 65",
  IMAGE: "175 252 65",
  POWERPOINT_TEMPLATE: "242 165 36",
  TEXTURE: "242 165 36",
  VIDEO: "238 119 174",
  OTHER: "238 119 174",
};

export const LICENSE_LABELS: Record<LicenseType, string> = {
  REGULAR: "Regular license",
  EXTENDED: "Extended license",
  OTHER: "Other license",
  UNKNOWN: "Unknown",
};
