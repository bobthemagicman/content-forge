import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "@/lib/cx";

/** A card-sized skeleton: 16:10 box plus two text lines, inside the same glass panel. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cx("glass flex flex-col gap-3 rounded-lg p-2.5 pb-4", className)}>
      <Skeleton className="aspect-[16/10] rounded-md" />
      <Skeleton className="mx-1 h-4 w-4/5 rounded-full" />
      <Skeleton className="mx-1 h-3 w-2/5 rounded-full" />
    </div>
  );
}

/** Row-shaped skeleton for the browse page: header plus six cards at the real card width. */
export function RowSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-5">
        <Skeleton className="h-14 w-16 rounded-md" />
        <Skeleton className="mb-1 h-8 w-56 rounded-full" />
      </div>
      <div className="flex gap-4 overflow-hidden pt-2 pb-4">
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} className="w-[72vw] shrink-0 md:w-60 xl:w-68" />
        ))}
      </div>
    </div>
  );
}
