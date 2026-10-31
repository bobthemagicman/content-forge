"use client";

import { TypeIcon } from "@/components/icons";
import type { ContentTypeInfo } from "@/lib/content-types";
import { jumpToRow } from "@/lib/jump-to-row";

/** 3 × 2 glass tiles linking to each row that has items (FR-010, MASTER.md "Jump tiles"). */
export function JumpTiles({ types }: { types: readonly ContentTypeInfo[] }) {
  if (types.length === 0) return null;
  return (
    <nav aria-label="Jump to a type" className="hidden flex-[1_1_480px] md:block">
      <ul className="grid grid-cols-3 gap-3">
        {types.map((t) => (
          <li key={t.type} data-type={t.routeSlug}>
            <a
              href={`#${t.rowId}`}
              onClick={(e) => {
                if (jumpToRow(t.rowId)) e.preventDefault();
              }}
              className={
                "group glass relative flex min-h-[132px] flex-col justify-end gap-2 overflow-hidden rounded-xl px-5 py-4.5 " +
                "transition-[transform,border-color,box-shadow] duration-200 ease-out " +
                "hover:border-[rgb(var(--accent-rgb)/0.6)] hover:shadow-glow-tile motion-safe:hover:-translate-y-1"
              }
            >
              <span
                aria-hidden
                className="absolute -top-10 -right-10 size-35 rounded-full bg-[radial-gradient(closest-side,rgb(var(--accent-rgb)/0.45),transparent)] transition-transform duration-300 motion-safe:group-hover:scale-140"
              />
              <TypeIcon type={t.type} size={26} className="relative text-accent" />
              <span className="font-display relative text-lg leading-tight text-text-strong">{t.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
