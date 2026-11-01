"use client";

import { useCallback, useEffect, useState } from "react";
import { RowSkeleton } from "@/components/card-skeleton";
import { CategoryRow } from "@/components/category-row";
import { EmptyState } from "@/components/empty-state";
import { InboxIcon } from "@/components/icons";
import { JumpTiles } from "@/components/jump-tiles";
import { LoadingRegion } from "@/components/ui/skeleton";
import { CONTENT_TYPES, type ContentType, type ContentTypeInfo } from "@/lib/content-types";
import { useRow } from "@/lib/data/use-row";
import { jumpToRow } from "@/lib/jump-to-row";

type RowOutcome = "loading" | "empty" | "filled" | "error";

const INITIAL = Object.fromEntries(CONTENT_TYPES.map((t) => [t.type, "loading"])) as Record<ContentType, RowOutcome>;

/**
 * Browse (pages/browse.md, T088): a hero with jump tiles, then one row per type that has items.
 * Rows fetch in parallel and are revealed together once all have answered, so partial results
 * never shift the layout; until then three skeleton rows hold the space.
 */
export function BrowseView() {
  const [outcomes, setOutcomes] = useState(INITIAL);
  const report = useCallback((type: ContentType, outcome: RowOutcome) => {
    setOutcomes((prev) => (prev[type] === outcome ? prev : { ...prev, [type]: outcome }));
  }, []);

  const values = Object.values(outcomes);
  // Latched: once every row has answered, a row that retries later shows its own skeleton instead of
  // putting the whole page back into the loading state.
  const [settled, setSettled] = useState(false);
  if (!settled && !values.includes("loading")) setSettled(true);
  const allEmpty = values.every((o) => o === "empty");
  const tileTypes = settled ? CONTENT_TYPES.filter((t) => outcomes[t.type] !== "empty") : CONTENT_TYPES;

  // Arriving from another page's type link (/browse/#row-<slug>): jump once the rows exist.
  useEffect(() => {
    if (settled && location.hash) jumpToRow(decodeURIComponent(location.hash.slice(1)));
  }, [settled]);

  return (
    <div className="container-page flex flex-col gap-14 pt-8 pb-20 md:pt-10">
      <section aria-labelledby="page-title" className="flex flex-wrap items-center gap-12 pt-4 pb-2">
        <div className="flex flex-[1_1_520px] flex-col items-start gap-5">
          <h1
            id="page-title"
            className="text-gradient pb-1.5 text-[clamp(64px,9vw,96px)] leading-[0.95] tracking-[-0.03em]"
          >
            Browse
          </h1>
          <p className="font-display text-[28px] leading-tight text-balance text-text-strong">
            Your whole library, ready when you are.
          </p>
          <p className="max-w-[52ch] text-body-lg text-text">
            Templates, decks, clips, photos, textures, and odds and ends you&rsquo;ve already paid for. Preview
            anything, download in a click.
          </p>
        </div>
        {!allEmpty && <JumpTiles types={tileTypes} />}
      </section>

      {!settled && (
        <LoadingRegion label="Loading the catalog…" className="flex flex-col gap-14">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </LoadingRegion>
      )}

      {settled && allEmpty && (
        <EmptyState icon={<InboxIcon size={32} />} title="No content yet.">
          Items appear here as soon as they&rsquo;re imported.
        </EmptyState>
      )}

      {CONTENT_TYPES.map((info, i) => (
        <BrowseRow key={info.type} info={info} revealed={settled} onOutcome={report} priority={i === 0} />
      ))}
    </div>
  );
}

function BrowseRow({
  info,
  revealed,
  onOutcome,
  priority,
}: {
  info: ContentTypeInfo;
  revealed: boolean;
  onOutcome: (type: ContentType, outcome: RowOutcome) => void;
  priority: boolean;
}) {
  const row = useRow(info.type);
  const outcome: RowOutcome =
    row.status === "loading" ? "loading" : row.status === "error" ? "error" : row.items.length ? "filled" : "empty";

  useEffect(() => onOutcome(info.type, outcome), [info.type, outcome, onOutcome]);

  if (!revealed || outcome === "empty") return null;
  return <CategoryRow info={info} row={row} priority={priority} />;
}
