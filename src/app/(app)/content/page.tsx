import type { Metadata } from "next";
import { Suspense } from "react";
import { DetailSkeleton, DetailView } from "@/components/detail/detail-view";

export const metadata: Metadata = { title: "Item" };

// The slug arrives as ?slug=, read on the client inside Suspense (static export, ui-routes.md).
export default function ContentPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailView />
    </Suspense>
  );
}
