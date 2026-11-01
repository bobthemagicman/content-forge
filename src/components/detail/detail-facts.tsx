import { TextLink } from "@/components/ui/link";
import { LICENSE_LABELS } from "@/lib/content-types";
import { cx } from "@/lib/cx";
import type { ContentItem, ImageMeta, OtherMeta, PowerPointMeta, VideoMeta, WebsiteTemplateMeta } from "@/lib/data/types";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";

interface Fact {
  label: string;
  value: React.ReactNode;
  /** Spans both stat columns (long values such as dimensions). */
  wide?: boolean;
}

/** The 2–4 numeric facts shown as stat tiles (pages/detail.md "Metadata"). */
export function statFacts(item: ContentItem): Fact[] {
  const stats: Fact[] = [{ label: "Download size", value: formatBytes(item.archiveBytes) }];
  const meta = item.meta;
  switch (item.type) {
    case "WEBSITE_TEMPLATE": {
      const m = meta as WebsiteTemplateMeta | undefined;
      if (m?.pageCount) stats.push({ label: "Pages", value: m.pageCount });
      if (m?.demoVariants?.length) stats.push({ label: "Demo variants", value: m.demoVariants.length });
      break;
    }
    case "POWERPOINT_TEMPLATE": {
      const m = meta as PowerPointMeta | undefined;
      if (m?.slideCount) stats.push({ label: "Slides", value: m.slideCount });
      break;
    }
    case "VIDEO": {
      const m = meta as VideoMeta | undefined;
      if (m?.durationSec) stats.push({ label: "Duration", value: formatDuration(m.durationSec) });
      break;
    }
    case "IMAGE":
    case "TEXTURE": {
      const m = meta as ImageMeta | undefined;
      if (m?.width) stats.push({ label: "Pixels", value: `${m.width.toLocaleString("en-US")} × ${m.height.toLocaleString("en-US")}`, wide: true });
      break;
    }
    case "OTHER": {
      const m = meta as OtherMeta | undefined;
      if (m?.fileList) stats.push({ label: "Files", value: (m.totalFiles ?? m.fileList.length).toLocaleString("en-US") });
      break;
    }
  }
  // Hidden until someone has downloaded it (FR-021, T118).
  if (item.downloadCount > 0) stats.push({ label: item.downloadCount === 1 ? "Download" : "Downloads", value: item.downloadCount });
  return stats;
}

/** Everything that isn't a stat tile, as key/value rows. */
export function listFacts(item: ContentItem): Fact[] {
  const facts: Fact[] = [];
  if (item.sourceMarketplace)
    facts.push({
      label: "Source",
      value: item.sourceUrl ? (
        <TextLink href={item.sourceUrl} target="_blank">
          {item.sourceMarketplace}
        </TextLink>
      ) : (
        item.sourceMarketplace
      ),
    });
  facts.push({ label: "License", value: LICENSE_LABELS[item.licenseType] });
  facts.push({ label: "File", value: item.archiveFileName });
  if (item.purchaseDate) facts.push({ label: "Purchased", value: formatDate(item.purchaseDate) });

  const meta = item.meta;
  switch (item.type) {
    case "WEBSITE_TEMPLATE": {
      const m = meta as WebsiteTemplateMeta | undefined;
      if (m?.demoVariants?.length) facts.push({ label: "Variants", value: m.demoVariants.join(", ") });
      break;
    }
    case "POWERPOINT_TEMPLATE": {
      const m = meta as PowerPointMeta | undefined;
      if (m) facts.push({ label: "Aspect ratio", value: m.aspectRatio }, { label: "Deck", value: m.deckFileName });
      break;
    }
    case "VIDEO": {
      const m = meta as VideoMeta | undefined;
      if (m)
        facts.push(
          { label: "Resolution", value: `${m.width} × ${m.height}` },
          { label: "Frame rate", value: `${m.fps} fps` },
          { label: "Codec", value: m.codec },
        );
      break;
    }
    case "IMAGE":
    case "TEXTURE": {
      const m = meta as ImageMeta | undefined;
      if (m) facts.push({ label: "Format", value: m.format });
      break;
    }
  }
  return facts;
}

/** Stat tiles, metadata list, description, and tags (FR-015, T097). */
export function DetailFacts({ item }: { item: ContentItem }) {
  return (
    <>
      <dl className="grid grid-flow-dense grid-cols-2 gap-2.5">
        {statFacts(item).map((s) => (
          <div key={s.label} className={cx("glass flex flex-col gap-1 rounded-lg px-4.5 py-4", s.wide && "col-span-2")}>
            <dt className="order-2 text-sm text-text-muted">{s.label}</dt>
            <dd className="font-display order-1 text-stat text-text-strong tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="border-b border-glass-border">
        {listFacts(item).map((f) => (
          <div key={f.label} className="flex justify-between gap-4 border-t border-glass-border py-3">
            <dt className="label pt-0.5 text-text-muted">{f.label}</dt>
            <dd className="text-right text-sm text-text tabular-nums [overflow-wrap:anywhere]">{f.value}</dd>
          </div>
        ))}
      </dl>
      {item.description && <p className="max-w-[70ch] text-body-lg text-text">{item.description}</p>}
      {item.tags && item.tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <li key={t} className="glass rounded-full px-3.5 py-1.5 text-sm text-text">
              {t}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
