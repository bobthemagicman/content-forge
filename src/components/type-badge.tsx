import { typeInfo, type ContentType } from "@/lib/content-types";
import { cx } from "@/lib/cx";

/** Accent dot + label. `size="lg"` is the detail page's tinted pill (MASTER.md "Type badge"). */
export function TypeBadge({ type, size = "sm" }: { type: ContentType; size?: "sm" | "lg" }) {
  const { badge, routeSlug } = typeInfo(type);
  return (
    <span
      data-type={routeSlug}
      className={cx(
        "label inline-flex items-center gap-2",
        size === "sm"
          ? "text-text-muted"
          : "rounded-full border border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.1)] px-3 py-1.5 text-accent",
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
      {badge}
    </span>
  );
}
