"use client";

import { Link as AriaLink, composeRenderProps, type LinkProps } from "react-aria-components";
import { ExternalLinkIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

/** Body text link: magenta underline, never magenta text (MASTER.md "Text link"). */
export function TextLink({ className, children, ...props }: LinkProps) {
  const external = props.target === "_blank";
  return (
    <AriaLink
      {...props}
      rel={external ? "noopener noreferrer" : props.rel}
      className={composeRenderProps(className, (cls) =>
        cx(
          "cursor-pointer text-text underline decoration-secondary decoration-1 underline-offset-3",
          "data-hovered:text-text-strong data-hovered:decoration-2 rounded-sm",
          cls,
        ),
      )}
    >
      {composeRenderProps(children, (content) => (
        <>
          {content}
          {external && (
            <>
              <ExternalLinkIcon size={14} className="ml-1 inline-block align-[-2px]" />
              <span className="sr-only"> (opens in new tab)</span>
            </>
          )}
        </>
      ))}
    </AriaLink>
  );
}
