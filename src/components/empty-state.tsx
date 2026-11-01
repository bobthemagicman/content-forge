import { cx } from "@/lib/cx";

/** Centered glass panel with an icon, a heading, one sentence, and one action (MASTER.md). */
export function EmptyState({
  icon,
  title,
  children,
  action,
  headingLevel = 2,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className={cx("glass mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl px-8 py-12 text-center", className)}>
      <span className="flex size-16 items-center justify-center rounded-full bg-[radial-gradient(closest-side,rgb(var(--accent-rgb)/0.35),transparent)] text-accent">
        {icon}
      </span>
      <Heading className="text-h3 text-text-strong">{title}</Heading>
      {children && <p className="text-text">{children}</p>}
      {action}
    </div>
  );
}
