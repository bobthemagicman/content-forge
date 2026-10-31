"use client";

// The installed react-aria-components only exports Toast under UNSTABLE_ names. They're imported
// here and nowhere else, so a future rename touches one file (T032).
import {
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import { AlertCircleIcon, InfoIcon, XIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { IconButton } from "./icon-button";

export interface ToastContentValue {
  tone: "error" | "info";
  title: string;
  description?: string;
}

const queue = new ToastQueue<ToastContentValue>({ maxVisibleToasts: 3 });

export function useToast() {
  return {
    show: (content: ToastContentValue, timeout = 6000) => queue.add(content, { timeout }),
  };
}

export function Toaster() {
  return (
    <ToastRegion queue={queue} className="fixed right-4 bottom-4 z-[1000] flex w-[min(420px,calc(100vw-32px))] flex-col gap-3 outline-none">
      {({ toast }) => {
        const Icon = toast.content.tone === "error" ? AlertCircleIcon : InfoIcon;
        return (
          <Toast
            toast={toast}
            className={cx(
              "flex items-start gap-3 rounded-md border bg-raised p-4 pr-2 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]",
              toast.content.tone === "error" ? "border-danger" : "border-callout",
            )}
          >
            <Icon size={20} className={cx("mt-0.5 shrink-0", toast.content.tone === "error" ? "text-danger" : "text-callout")} />
            <ToastContent className="min-w-0 flex-1">
              <Text slot="title" className="block font-bold text-text-strong">
                {toast.content.title}
              </Text>
              {toast.content.description && (
                <Text slot="description" className="block text-sm text-text">
                  {toast.content.description}
                </Text>
              )}
            </ToastContent>
            <IconButton slot="close" aria-label="Dismiss" className="size-9 border-transparent bg-transparent">
              <XIcon size={16} />
            </IconButton>
          </Toast>
        );
      }}
    </ToastRegion>
  );
}
