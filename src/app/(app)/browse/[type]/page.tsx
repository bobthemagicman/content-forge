import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeeAllView } from "@/components/browse/see-all-view";
import { CONTENT_TYPES, typeFromRouteSlug, typeInfo } from "@/lib/content-types";

// The six type pages are the only ones that exist (static export, FR-013).
export const dynamicParams = false;

export function generateStaticParams() {
  return CONTENT_TYPES.map((t) => ({ type: t.routeSlug }));
}

export async function generateMetadata({ params }: PageProps<"/browse/[type]">): Promise<Metadata> {
  const type = typeFromRouteSlug((await params).type);
  return { title: type ? typeInfo(type).label : "Not found" };
}

export default async function SeeAllPage({ params }: PageProps<"/browse/[type]">) {
  const type = typeFromRouteSlug((await params).type);
  if (!type) notFound();
  return <SeeAllView type={type} />;
}
