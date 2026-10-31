"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Collection, GridList, GridListLoadMoreItem, Link } from "react-aria-components";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { CardSkeleton } from "@/components/card-skeleton";
import { Banner } from "@/components/ui/banner";
import { IconButton } from "@/components/ui/icon-button";
import { LoadingRegion } from "@/components/ui/skeleton";
import { rowNumber, type ContentTypeInfo } from "@/lib/content-types";
import { cx } from "@/lib/cx";
import type { RowState } from "@/lib/data/use-row";
import { ContentCard } from "./content-card";

/**
 * One horizontally scrolling row per content type (MASTER.md "Category row", T087). The GridList is
 * a single Tab stop; arrow keys move between cards and Enter opens one. The previous/next buttons
 * are the non-drag alternative (WCAG 2.5.7).
 */
export function CategoryRow({ info, row, priority = false }: { info: ContentTypeInfo; row: RowState; priority?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, row.items.length]);

  function scrollBy(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section aria-labelledby={info.rowId} data-type={info.routeSlug} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <span aria-hidden className="index-number">
          {rowNumber(info.type)}
        </span>
        <h2 id={info.rowId} tabIndex={-1} className="mb-1 rounded-sm text-h2 outline-none focus-visible:outline-2">
          {info.label}
        </h2>
        <Link
          href={`/browse/${info.routeSlug}/`}
          aria-label={`See all ${info.label}`}
          className="group mb-2 inline-flex items-center gap-1.5 rounded-sm text-sm text-text data-hovered:text-text-strong"
        >
          See all
          <ArrowRightIcon size={16} className="transition-transform duration-200 motion-safe:group-data-hovered:translate-x-1" />
        </Link>
        <div className="ml-auto hidden gap-2 md:flex">
          <IconButton
            aria-label={`Scroll ${info.label} left`}
            aria-hidden={edges.start || undefined}
            isDisabled={edges.start}
            onPress={() => scrollBy(-1)}
          >
            <ChevronLeftIcon size={20} />
          </IconButton>
          <IconButton
            aria-label={`Scroll ${info.label} right`}
            aria-hidden={edges.end || undefined}
            isDisabled={edges.end}
            onPress={() => scrollBy(1)}
          >
            <ChevronRightIcon size={20} />
          </IconButton>
        </div>
      </div>

      {row.status === "loading" ? (
        <LoadingRegion label={`Loading ${info.label}…`} className="-mx-1 -mt-2 flex gap-4 overflow-hidden px-1 pt-2 pb-4">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} className="w-[72vw] shrink-0 md:w-60 xl:w-68" />
          ))}
        </LoadingRegion>
      ) : row.status === "error" ? (
        <Banner title={`${info.label} didn't load.`} onRetry={row.retry}>
          Check your connection, then try again.
        </Banner>
      ) : (
        <GridList
          ref={scroller}
          aria-label={info.label}
          layout="stack"
          orientation="horizontal"
          onScroll={measure}
          className={cx(
            "-mx-1 -mt-2 flex snap-x snap-proximity gap-4 overflow-x-auto px-1 pt-2 pb-4 outline-none",
            "scroll-px-4 md:scroll-px-6 xl:scroll-px-12",
            "[scrollbar-color:rgb(255_255_255/0.18)_transparent] [scrollbar-width:thin]",
          )}
        >
          <Collection items={row.items}>
            {(item) => (
              <ContentCard item={item} priority={priority} className="w-[72vw] shrink-0 snap-start md:w-60 xl:w-68" />
            )}
          </Collection>
          {row.hasMore && <GridListLoadMoreItem onLoadMore={row.loadMore} isLoading={row.isLoadingMore} />}
        </GridList>
      )}
    </section>
  );
}
