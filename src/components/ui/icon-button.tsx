"use client";

import { Button as AriaButton, type ButtonProps } from "react-aria-components";
import { cx } from "@/lib/cx";

/** Round 44px glass icon button. Hover takes the surrounding type accent (MASTER.md "Icon button"). */
export function IconButton({ className, ...props }: ButtonProps & { "aria-label": string; className?: string }) {
  return (
    <AriaButton
      {...props}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-glass-edge bg-glass text-text cursor-pointer",
        "transition-[background-color,border-color] duration-200",
        "data-hovered:border-[rgb(var(--accent-rgb)/0.6)] data-hovered:bg-[rgb(var(--accent-rgb)/0.15)]",
        "data-disabled:cursor-default data-disabled:text-control-border data-disabled:data-hovered:bg-glass data-disabled:data-hovered:border-glass-edge",
        className,
      )}
    />
  );
}
