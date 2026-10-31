"use client";

import { Collection, GridList } from "react-aria-components";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CardSkeleton } from "@/components/card-skeleton";
import { ContentCard } from "@/components/content-card";
import { EmptyState } from "@/components/empty-state";
import { TypeIcon } from "@/components/icons";
import { Banner } from "@/components/ui/banner";
import { Button, LinkButton } from "@/components/ui/button";
import { LoadingRegion } from "@/components/ui/skeleton";
import { rowNumber, typeInfo, type ContentType } from "@/lib/content-types";
import { useRow } from "@/lib/data/use-row";

/** Every published item of one type as a grid (pages/see-all.md, T116). */
export function SeeAllView({ type }: { type: ContentType }) {
  const info = typeInfo(type);
  const row = useRow(type, { limit: 60 });

  return (
    <div data-type={info.routeSlug} className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-[520px] bg-[radial-gradient(900px_420px_at_20%_30%,rgb(var(--accent-rgb)/0.12),transparent_70%)]"
      />
      <div className="container-page relative flex flex-col gap-8 pt-8 pb-20">
        <Breadcrumbs items={[{ label: "Browse", href: "/browse/" }, { label: info.label }]} />
        <div className="flex items-end gap-5">
          <span aria-hidden className="index-number">
            {rowNumber(type)}
          </span>
          <h1 className="mb-1 text-h1">{info.label}</h1>
        </div>

        {row.status === "loading" && (
          <LoadingRegion label={`Loading ${info.label}…`} className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-6">
            {Array.from({ length: 12 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </LoadingRegion>
        )}

        {row.status === "error" && (
          <Banner title={`${info.label} didn't load.`} onRetry={row.retry}>
            Check your connection, then try again.
          </Banner>
        )}

        {row.status === "ready" && row.items.length === 0 && (
          <EmptyState
            icon={<TypeIcon type={type} size={32} />}
            title={`Nothing in ${info.label} yet.`}
            action={
              <LinkButton href="/browse/" variant="quiet" className="border border-glass-edge">
                Back to Browse
              </LinkButton>
            }
          />
        )}

        {row.status === "ready" && row.items.length > 0 && (
          <>
            <GridList
              aria-label={info.label}
              layout="grid"
              className="grid grid-cols-2 gap-4 outline-none md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-6"
            >
              <Collection items={row.items}>{(item) => <ContentCard item={item} />}</Collection>
            </GridList>
            {row.hasMore && (
              <div className="flex justify-center">
                <Button variant="secondary" onPress={row.loadMore} isPending={row.isLoadingMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
