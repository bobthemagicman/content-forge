"use client";

import { useState } from "react";
import { DownloadIcon, ExternalLinkIcon } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/button";
import { useToast, type ToastContentValue } from "@/components/ui/toast";
import { demoUrl } from "@/lib/assets/asset-url";
import { requestDownloadUrl } from "@/lib/data/content";
import { DownloadError, type ContentItem, type DownloadErrorType } from "@/lib/data/types";
import { formatBytes } from "@/lib/format";

/** Client UX per `errorType` (contracts/data-api.md §3). */
const DOWNLOAD_ERRORS: Record<DownloadErrorType, ToastContentValue> = {
  Unauthorized: { tone: "error", title: "Your session has ended.", description: "Sign in again to download." },
  NotFound: { tone: "error", title: "This item is no longer available." },
  ArchiveMissing: { tone: "error", title: "The file for this item is missing.", description: "Please let the owner know." },
  InternalError: { tone: "error", title: "Download failed. Please try again." },
  BetaPreview: {
    tone: "info",
    title: "Downloads are off in the beta preview.",
    description: "This item is sample data, so there's no file behind it yet.",
  },
};

const newTab = <span className="sr-only"> (opens in new tab)</span>;

/**
 * Download (the page's one lime button), plus Live demo or Vendor demo following the action rules
 * in contracts/ui-routes.md (T098, T105).
 */
export function DetailActions({ item }: { item: ContentItem }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const liveDemo = item.type === "WEBSITE_TEMPLATE" ? demoUrl(item) : null;

  async function download() {
    setPending(true);
    try {
      const { url } = await requestDownloadUrl(item.id);
      window.location.assign(url);
    } catch (err) {
      toast.show(DOWNLOAD_ERRORS[err instanceof DownloadError ? err.errorType : "InternalError"]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" size="lg" className="w-full" onPress={download} isPending={pending}>
        {pending ? (
          <span className="size-5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-[spin_0.8s_linear_infinite]" aria-hidden />
        ) : (
          <DownloadIcon size={20} strokeWidth={2} className="bob" />
        )}
        Download · {formatBytes(item.archiveBytes)}
      </Button>
      {liveDemo ? (
        <Button variant="secondary" className="h-12 w-full" onPress={() => window.open(liveDemo, "_blank", "noopener")}>
          <ExternalLinkIcon size={16} strokeWidth={2} />
          Live demo{newTab}
        </Button>
      ) : (
        item.externalDemoUrl && (
          <LinkButton
            variant="secondary"
            className="h-12 w-full"
            href={item.externalDemoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLinkIcon size={16} strokeWidth={2} />
            Vendor demo{newTab}
          </LinkButton>
        )
      )}
    </div>
  );
}
