"use client";

import Image from "next/image";
import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Lightbox } from "@/components/ui/lightbox";
import type { ContentItem, PowerPointMeta } from "@/lib/data/types";

/** Up to 12 slides in a grid; activating one opens it larger in the lightbox (T109). */
export function SlideGallery({ item }: { item: ContentItem }) {
  const slides = (item.previewKeys ?? []).slice(0, 12);
  const meta = item.meta as PowerPointMeta | undefined;
  const total = meta?.slideCount ?? slides.length;
  const [w, h] = meta?.aspectRatio === "4:3" ? [1200, 900] : [1600, 900];
  const [open, setOpen] = useState<number | null>(null);

  if (slides.length === 0) return null;
  const label = (n: number) => `Slide ${n} of ${total}`;

  return (
    <>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {slides.map((key, i) => (
          <li key={key} className="flex flex-col gap-2">
            <AriaButton
              onPress={() => setOpen(i)}
              aria-label={`Open ${label(i + 1).toLowerCase()} larger`}
              className={
                "glass block cursor-zoom-in overflow-hidden rounded-md p-0 transition-[transform,border-color,box-shadow] duration-200 " +
                "data-hovered:border-[rgb(var(--accent-rgb)/0.6)] data-hovered:shadow-glow-accent motion-safe:data-hovered:-translate-y-1"
              }
            >
              <Image src={key} alt={`${item.title} preview ${i + 1}`} width={w} height={h} sizes="240px" className="block h-auto w-full" />
            </AriaButton>
            <span className="text-sm text-text-muted">{label(i + 1)}</span>
          </li>
        ))}
      </ul>
      <Lightbox
        isOpen={open !== null}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        title={open === null ? "" : label(open + 1)}
        toolbar={
          <div className="flex gap-2">
            <IconButton aria-label="Previous slide" isDisabled={open === 0} onPress={() => setOpen((n) => (n ? n - 1 : n))}>
              <ChevronLeftIcon size={20} />
            </IconButton>
            <IconButton
              aria-label="Next slide"
              isDisabled={open === slides.length - 1}
              onPress={() => setOpen((n) => (n !== null && n < slides.length - 1 ? n + 1 : n))}
            >
              <ChevronRightIcon size={20} />
            </IconButton>
          </div>
        }
      >
        {open !== null && (
          <div className="p-4">
            <Image src={slides[open]} alt={`${item.title} preview ${open + 1}`} width={w} height={h} sizes="90vw" className="block h-[min(75dvh,56vw)] w-full object-contain" />
          </div>
        )}
      </Lightbox>
    </>
  );
}
