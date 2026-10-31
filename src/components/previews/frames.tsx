import { cx } from "@/lib/cx";

/** Glass frame with the item glow, for slides, video, images, and textures (MASTER.md "Preview frames"). */
export function GlassFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("glass overflow-hidden rounded-lg shadow-glow-preview", className)}>{children}</div>;
}

/** Desktop screenshot in a browser frame: 40px title bar, three dots, the demo path in a muted pill. */
export function BrowserFrame({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-glass-border bg-raised shadow-glow-preview">
      <div className="flex h-10 items-center gap-2 px-4">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
        </span>
        <span className="mx-auto max-w-[60%] truncate rounded-full bg-glass px-4 py-1 text-xs text-text-muted">{path}</span>
      </div>
      {children}
    </div>
  );
}

/** Mobile screenshot in a phone frame on a glowing glass field. */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass flex justify-center rounded-lg bg-[radial-gradient(closest-side,rgb(var(--item-glow-rgb,var(--accent-rgb))/0.3),transparent)] px-4 py-10">
      <div className="relative w-[300px] max-w-full rounded-[40px] border border-glass-edge bg-[#05030a] p-2.5 shadow-glow-preview">
        <span aria-hidden className="absolute top-4 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#05030a]" />
        <div className="overflow-hidden rounded-[30px]">{children}</div>
      </div>
    </div>
  );
}
