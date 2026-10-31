"use client";

import { assetUrl } from "@/lib/assets/asset-url";
import type { ContentItem, VideoMeta } from "@/lib/data/types";
import { formatDuration } from "@/lib/format";
import { GlassFrame } from "./frames";

/**
 * Native video, click to play, never autoplays (T110). An asset error will ask the asset session to
 * refresh once (reportAssetError, T036) when the signed-cookie plane exists.
 */
export function VideoPreview({ item }: { item: ContentItem }) {
  if (!item.videoPreviewKey) return null;
  const meta = item.meta as VideoMeta | undefined;
  return (
    <figure className="flex flex-col gap-4">
      <GlassFrame>
        <video
          controls
          preload="metadata"
          playsInline
          poster={item.posterKey ? assetUrl(item.posterKey) : undefined}
          src={assetUrl(item.videoPreviewKey)}
          aria-label={`${item.title} preview clip`}
          className="block aspect-video w-full bg-black"
        />
      </GlassFrame>
      <figcaption className="text-sm text-text-muted">
        Preview clip, up to 30 seconds.
        {meta && ` Full length ${formatDuration(meta.durationSec)} at ${meta.width} × ${meta.height}.`}
      </figcaption>
    </figure>
  );
}
