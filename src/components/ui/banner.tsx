"use client";

import { AlertCircleIcon, InfoIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { Button } from "./button";

export interface BannerProps {
  tone?: "error" | "info";
  title: string;
  children?: React.ReactNode;
  /** Shows a "Try again" quiet button. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Alert / banner: glass fill, status-colored border and icon, words plus a way forward. */
export function Banner({ tone = "error", title, children, onRetry, retryLabel = "Try again", className }: BannerProps) {
  const Icon = tone === "error" ? AlertCircleIcon : InfoIcon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex flex-wrap items-start gap-3 rounded-md border bg-glass p-4",
        tone === "error" ? "border-danger" : "border-callout",
        className,
      )}
    >
      <Icon size={20} className={cx("mt-0.5 shrink-0", tone === "error" ? "text-danger" : "text-callout")} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-text-strong">{title}</p>
        {children && <div className="text-sm text-text">{children}</div>}
      </div>
      {onRetry && (
        <Button variant="quiet" size="sm" onPress={onRetry} className="border border-glass-edge">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
