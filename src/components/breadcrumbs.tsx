"use client";

import { Breadcrumb, Breadcrumbs as AriaBreadcrumbs, Link } from "react-aria-components";

export interface Crumb {
  label: string;
  href?: string;
}

/** "Browse / <Type> / <Title>". The last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <AriaBreadcrumbs className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        {items.map((c, i) => (
          <Breadcrumb key={c.label} id={String(i)} className="flex items-center gap-2">
            {({ isCurrent }) => (
              <>
                <Link
                  href={isCurrent ? undefined : c.href}
                  className="rounded-sm text-text-muted data-hovered:text-text-strong data-current:text-text data-current:cursor-default"
                >
                  {c.label}
                </Link>
                {!isCurrent && <span aria-hidden>/</span>}
              </>
            )}
          </Breadcrumb>
        ))}
      </AriaBreadcrumbs>
    </nav>
  );
}
