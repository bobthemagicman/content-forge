"use client";

import Image from "next/image";
import { GridListItem } from "react-aria-components";
import { PlayIcon, TypeIcon } from "@/components/icons";
import { typeInfo } from "@/lib/content-types";
import { cx } from "@/lib/cx";
import type { ContentSummary } from "@/lib/data/types";
import { TypeBadge } from "./type-badge";

export function detailHref(slug: string) {
  return `/content/?slug=${encodeURIComponent(slug)}`;
}

/**
 * Glass asset card (MASTER.md "Asset card"): a GridList item that links to the detail page.
 * `width` is the CSS flex-basis in rows; grids pass "auto".
 */
export function ContentCard({ item, className, priority = false }: { item: ContentSummary; className?: string; priority?: boolean }) {
  const info = typeInfo(item.type);
  const thumb = item.thumbKeys["320"];
  return (
    <GridListItem
      id={item.id}
      href={detailHref(item.slug)}
      textValue={`${item.title}, ${info.badge}`}
      data-type={info.routeSlug}
      className={({ isHovered, isFocusVisible }) =>
        cx(
          "group glass flex cursor-pointer flex-col gap-3 rounded-lg p-2.5 pb-4 outline-none",
          "transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out",
          isHovered && "border-[rgb(var(--accent-rgb)/0.6)] bg-glass-hover shadow-glow-accent motion-safe:-translate-y-1.5",
          isFocusVisible && "outline-2 outline-offset-4 outline-focus",
          className,
        )
      }
    >
      {({ isHovered }) => (
        <>
          <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-glass">
            {thumb ? (
              <Image
                src={thumb}
                alt={`${item.title} preview`}
                fill
                sizes="(min-width: 1280px) 272px, (min-width: 768px) 240px, 72vw"
                priority={priority}
                className={cx("object-cover transition-transform duration-350 ease-out", isHovered && "motion-safe:scale-[1.03]")}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 bg-raised text-text-muted">
                <TypeIcon type={item.type} size={40} strokeWidth={1.5} />
              </div>
            )}
            {item.type === "VIDEO" && (
              <span
                aria-hidden
                className={cx(
                  "absolute top-1/2 left-1/2 flex size-11 -translate-1/2 items-center justify-center rounded-full transition-colors duration-200",
                  isHovered ? "bg-accent text-[#111111]" : "bg-black/60 text-white",
                )}
              >
                <PlayIcon size={16} />
              </span>
            )}
          </div>
          <span className="line-clamp-2 px-1 text-card font-bold text-text-strong">{item.title}</span>
          <span className="px-1">
            <TypeBadge type={item.type} />
          </span>
        </>
      )}
    </GridListItem>
  );
}
