"use client";

import Image from "next/image";
import { useState } from "react";
import { ExpandIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Lightbox } from "@/components/ui/lightbox";
import type { ContentItem, ImageMeta } from "@/lib/data/types";
import { GlassFrame } from "./frames";

const ZOOM_STEPS = [1, 1.5, 2, 3, 4];

/**
 * The large preview, with Zoom opening the lightbox (T111). + / − buttons change the zoom, so it
 * never depends on pinch or wheel; panning is plain overflow scrolling.
 */
export function ImageZoom({ item }: { item: ContentItem }) {
  const key = item.previewKeys?.[0];
  const meta = item.meta as ImageMeta | undefined;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  if (!key) return null;
  const alt = `${item.title} preview 1`;
  const [w, h] = [2048, Math.round(2048 * ((meta?.height ?? 2) / (meta?.width ?? 3)))];

  return (
    <div className="flex flex-col gap-4">
      <GlassFrame>
        <Image src={key} alt={alt} width={w} height={h} sizes="(min-width: 1024px) 66vw, 100vw" priority className="block h-auto w-full" />
      </GlassFrame>
      <div>
        <Button variant="quiet" className="border border-glass-edge" onPress={() => setOpen(true)}>
          <ExpandIcon size={18} />
          Zoom
        </Button>
      </div>
      <Lightbox
        isOpen={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setStep(0);
        }}
        title={item.title}
        toolbar={
          <div className="flex items-center gap-2">
            <IconButton aria-label="Zoom out" isDisabled={step === 0} onPress={() => setStep((s) => Math.max(0, s - 1))}>
              <MinusIcon size={20} />
            </IconButton>
            <span className="w-12 text-center text-sm text-text tabular-nums" aria-live="polite">
              {Math.round(ZOOM_STEPS[step] * 100)}%
            </span>
            <IconButton
              aria-label="Zoom in"
              isDisabled={step === ZOOM_STEPS.length - 1}
              onPress={() => setStep((s) => Math.min(ZOOM_STEPS.length - 1, s + 1))}
            >
              <PlusIcon size={20} />
            </IconButton>
          </div>
        }
      >
        <div className="h-[75dvh] overflow-auto" tabIndex={0} aria-label="Zoomed image, scroll to pan">
          <Image
            src={key}
            alt={alt}
            width={w}
            height={h}
            sizes="400vw"
            style={{ width: `${ZOOM_STEPS[step] * 100}%`, maxWidth: "none" }}
            className="block h-auto"
          />
        </div>
      </Lightbox>
    </div>
  );
}
