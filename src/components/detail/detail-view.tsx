"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { SearchXIcon } from "@/components/icons";
import { PreviewForType } from "@/components/previews";
import { TypeBadge } from "@/components/type-badge";
import { Banner } from "@/components/ui/banner";
import { LinkButton } from "@/components/ui/button";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { rgbTriple } from "@/lib/color";
import { ACCENT_RGB, typeInfo } from "@/lib/content-types";
import { getBySlug } from "@/lib/data/content";
import type { ContentItem } from "@/lib/data/types";
import { DetailActions } from "./detail-actions";
import { DetailFacts } from "./detail-facts";

type State = { status: "loading" } | { status: "notFound" } | { status: "error" } | { status: "ready"; item: ContentItem };

/** Detail page (pages/detail.md, T099): preview left, facts panel right. */
export function DetailView() {
  const slug = useSearchParams().get("slug");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [prevKey, setPrevKey] = useState({ slug, attempt });

  // A new slug or a retry starts over in the loading state (adjusting state during render).
  if (prevKey.slug !== slug || prevKey.attempt !== attempt) {
    setPrevKey({ slug, attempt });
    setState({ status: "loading" });
  }

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getBySlug(slug)
      .then((item) => !cancelled && setState(item ? { status: "ready", item } : { status: "notFound" }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  const item = state.status === "ready" ? state.item : null;
  useItemGlow(item);

  if (!slug || state.status === "notFound") return <NotFound />;
  if (state.status === "loading") return <DetailSkeleton />;
  if (state.status === "error")
    return (
      <div className="container-page pt-10 pb-20">
        <Banner title="This item didn't load." onRetry={() => setAttempt((n) => n + 1)}>
          Check your connection, then try again.
        </Banner>
      </div>
    );

  const info = typeInfo(state.item.type);
  return <ItemDetail item={state.item} typeLabel={info.label} typeSlug={info.routeSlug} />;
}

function ItemDetail({ item, typeLabel, typeSlug }: { item: ContentItem; typeLabel: string; typeSlug: string }) {
  const colon = item.title.indexOf(":");
  return (
    <div data-type={typeSlug} className="container-page flex flex-col gap-7 pt-8 pb-20">
      <title>{`${item.title} · Content Forge`}</title>
      <Breadcrumbs
        items={[
          { label: "Browse", href: "/browse/" },
          { label: typeLabel, href: `/browse/${typeSlug}/` },
          { label: item.title },
        ]}
      />
      <div className="grid items-start gap-12 lg:grid-cols-12">
        <section aria-label="Preview" className="min-w-0 lg:col-span-8">
          <PreviewForType item={item} />
        </section>
        <aside aria-labelledby="item-title" className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <div className="flex flex-col items-start gap-3.5">
            <TypeBadge type={item.type} size="lg" />
            <h1 id="item-title" className="text-[clamp(36px,4vw,48px)] leading-[1.05] tracking-[-0.015em]">
              {colon > 0 ? (
                <>
                  <span className="text-gradient">{item.title.slice(0, colon + 1)}</span>
                  {item.title.slice(colon + 1)}
                </>
              ) : (
                item.title
              )}
            </h1>
          </div>
          <DetailActions item={item} />
          <DetailFacts item={item} />
        </aside>
      </div>
    </div>
  );
}

/** Sets the page glow to the item's accentColor, or its type accent, while the page is open. */
function useItemGlow(item: ContentItem | null) {
  useEffect(() => {
    if (!item) return;
    const body = document.body;
    const rgb = item.accentColor ? rgbTriple(item.accentColor) : ACCENT_RGB[item.type];
    body.style.setProperty("--item-glow-rgb", rgb);
    body.dataset.glow = "item";
    return () => {
      body.style.removeProperty("--item-glow-rgb");
      delete body.dataset.glow;
    };
  }, [item]);
}

export function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading item…" className="container-page flex flex-col gap-7 pt-8 pb-20">
      <Skeleton className="h-4 w-64 rounded-full" />
      <div className="grid items-start gap-12 lg:grid-cols-12">
        <Skeleton className="aspect-[16/10] rounded-lg lg:col-span-8" />
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-11 w-full rounded-full" />
          <Skeleton className="h-11 w-3/4 rounded-full" />
          <Skeleton className="mt-2 h-[52px] w-full rounded-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}

function NotFound() {
  return (
    <div className="container-page pt-16 pb-20">
      <EmptyState
        headingLevel={1}
        icon={<SearchXIcon size={32} />}
        title="We couldn’t find that item."
        action={
          <LinkButton href="/browse/" variant="quiet" className="border border-glass-edge">
            Back to Browse
          </LinkButton>
        }
      >
        It may have been removed, or the link is incomplete.
      </EmptyState>
    </div>
  );
}
