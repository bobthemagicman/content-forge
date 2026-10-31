import { cx } from "@/lib/cx";

/** Glass placeholder at the size of what it replaces (MASTER.md "Skeleton"). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("bg-glass motion-safe:animate-[pulse-soft_1.2s_ease-in-out_infinite]", className)} />;
}

/** Wraps skeletons with the busy state and a visually hidden "Loading…". */
export function LoadingRegion({ children, label = "Loading…", className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </div>
  );
}
