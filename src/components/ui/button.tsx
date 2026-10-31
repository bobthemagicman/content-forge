"use client";

import {
  Button as AriaButton,
  Link as AriaLink,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
  type LinkProps as AriaLinkProps,
} from "react-aria-components";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

const base =
  "label inline-flex items-center justify-center gap-2.5 rounded-full px-5 whitespace-nowrap cursor-pointer select-none " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-(--ease-color) " +
  "data-disabled:cursor-default data-focus-visible:outline-offset-3";

const variants: Record<ButtonVariant, string> = {
  // The one lime element in its region (MASTER.md "Button").
  primary:
    "bg-primary text-on-primary shadow-glow-primary " +
    "data-hovered:bg-primary-hover data-hovered:shadow-glow-primary-hover motion-safe:data-hovered:-translate-y-0.5 " +
    "data-pressed:bg-primary-pressed data-pressed:translate-y-0 " +
    "data-disabled:bg-disabled data-disabled:text-text-muted data-disabled:shadow-none data-disabled:translate-y-0 " +
    "data-hovered:[&_.bob]:animate-[bob_0.6s_ease-in-out_infinite_alternate]",
  secondary:
    "border border-secondary bg-secondary-tint text-secondary-text " +
    "data-hovered:bg-secondary data-hovered:text-on-secondary " +
    "data-pressed:bg-secondary-pressed data-pressed:text-on-secondary " +
    "data-disabled:border-glass-border data-disabled:bg-transparent data-disabled:text-text-muted",
  quiet:
    "text-text data-hovered:bg-glass-hover data-pressed:bg-white/10 data-disabled:text-text-muted",
  danger:
    "border border-danger text-danger data-hovered:bg-danger data-hovered:text-[#111111] " +
    "data-disabled:border-glass-border data-disabled:text-text-muted",
};

const sizes: Record<ButtonSize, string> = {
  lg: "h-[52px] text-[13px]",
  md: "h-11",
  sm: "h-9",
};

export function buttonClasses(variant: ButtonVariant = "quiet", size: ButtonSize = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(className, (cls) => buttonClasses(variant, size, cls))}
    />
  );
}

export interface LinkButtonProps extends AriaLinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A link styled as a button (navigation, external demos). */
export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return (
    <AriaLink
      {...props}
      className={composeRenderProps(className, (cls) => buttonClasses(variant, size, cls))}
    />
  );
}
