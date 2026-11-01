import type { ContentItem } from "@/lib/data/types";
import { FileList } from "./file-list";
import { ImageZoom } from "./image-zoom";
import { ScreenshotGallery } from "./screenshot-gallery";
import { SlideGallery } from "./slide-gallery";
import { TextureTile } from "./texture-tile";
import { VideoPreview } from "./video-preview";

/** The preview that fits each content type (FR-024, FR-025, T114). */
export function PreviewForType({ item }: { item: ContentItem }) {
  switch (item.type) {
    case "WEBSITE_TEMPLATE":
      return <ScreenshotGallery item={item} />;
    case "POWERPOINT_TEMPLATE":
      return <SlideGallery item={item} />;
    case "VIDEO":
      return <VideoPreview item={item} />;
    case "IMAGE":
      return <ImageZoom item={item} />;
    case "TEXTURE":
      return <TextureTile item={item} />;
    case "OTHER":
      return <FileList item={item} />;
  }
}
