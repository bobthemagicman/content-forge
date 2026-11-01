import { assetUrl } from "@/lib/assets/asset-url";
import type { ContentItem } from "@/lib/data/types";

const SCALES = [25, 50, 100] as const;

/** The texture tiled at three scales, side by side (stacked on narrow screens) (T112). */
export function TextureTile({ item }: { item: ContentItem }) {
  const key = item.previewKeys?.[0];
  if (!key) return null;
  const url = assetUrl(key);
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {SCALES.map((scale) => (
        <li key={scale} className="relative">
          <div
            role="img"
            aria-label={`${item.title} tiled at ${scale}% scale`}
            className="aspect-square rounded-lg border border-glass-border shadow-glow-preview"
            style={{ backgroundImage: `url("${url}")`, backgroundRepeat: "repeat", backgroundSize: `${scale}%` }}
          />
          <span aria-hidden className="label absolute top-3 left-3 rounded-full border border-glass-edge bg-[rgb(11_7_16/0.7)] px-3 py-1.5 text-text-strong">
            {scale}%
          </span>
        </li>
      ))}
    </ul>
  );
}
