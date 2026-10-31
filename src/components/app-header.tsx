"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Button as AriaButton,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
} from "react-aria-components";
import { LogOutIcon, LogoMark, MenuIcon } from "@/components/icons";
import { initials, useSession } from "@/lib/auth/session";
import { CONTENT_TYPES } from "@/lib/content-types";
import { cx } from "@/lib/cx";
import { jumpToRow } from "@/lib/jump-to-row";

const pill =
  "inline-flex h-10 items-center rounded-full border border-transparent px-3.5 text-sm text-text whitespace-nowrap cursor-pointer " +
  "transition-[background-color,border-color] duration-200 " +
  "hover:border-white/12 hover:bg-glass-hover " +
  "aria-[current=page]:border-primary-tint-border aria-[current=page]:bg-primary-tint aria-[current=page]:text-primary";

const menuItem =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-text outline-none " +
  "data-focused:bg-glass-hover data-focus-visible:outline-2 data-focus-visible:outline-focus data-focus-visible:-outline-offset-2";

const popover = "min-w-56 rounded-xl border border-glass-border bg-raised p-1.5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] outline-none";

/** Sticky translucent header with the gradient hairline (MASTER.md "Header"). */
export function AppHeader() {
  const pathname = usePathname();
  const onBrowse = pathname === "/browse/" || pathname === "/browse";
  const links: { key: string; label: string; href: string; rowId?: string; current: boolean }[] = [
    { key: "browse", label: "Browse", href: "/browse/", current: onBrowse },
    ...CONTENT_TYPES.map((t) => ({
      key: t.routeSlug,
      label: t.navLabel,
      // Type links jump to the row on Browse (FR-010). See-all pages mark their type as current.
      href: `/browse/#${t.rowId}`,
      rowId: t.rowId,
      current: pathname.startsWith(`/browse/${t.routeSlug}`),
    })),
  ];

  function onNavigate(e: React.MouseEvent, rowId?: string) {
    if (rowId && onBrowse && jumpToRow(rowId)) e.preventDefault();
  }

  return (
    <header className="app-header sticky top-0 z-40 bg-header backdrop-blur-[18px]">
      <div className="container-page flex min-h-[72px] items-center gap-4 lg:gap-8">
        <NextLink
          href="/browse/"
          className="font-display flex shrink-0 items-center gap-2.5 rounded-sm text-lg text-text-strong"
        >
          <LogoMark size={22} />
          <span>Content Forge</span>
        </NextLink>

        <nav aria-label="Content types" className="hidden flex-1 lg:block">
          <ul className="flex flex-wrap gap-1">
            {links.map((l) => (
              <li key={l.key}>
                <NextLink
                  href={l.href}
                  aria-current={l.current ? "page" : undefined}
                  onClick={(e) => onNavigate(e, l.rowId)}
                  className={pill}
                >
                  {l.label}
                </NextLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <MenuTrigger>
            <AriaButton
              aria-label="Content types"
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-glass-edge bg-glass text-text data-hovered:bg-glass-hover lg:hidden"
            >
              <MenuIcon size={20} />
            </AriaButton>
            <Popover placement="bottom end" offset={8} className={popover}>
              <Menu
                aria-label="Content types"
                className="outline-none"
                onAction={(key) => {
                  const link = links.find((l) => l.key === key);
                  if (link?.rowId && onBrowse) jumpToRow(link.rowId);
                }}
              >
                {links.map((l) => (
                  <MenuItem
                    key={l.key}
                    id={l.key}
                    href={l.rowId && onBrowse ? undefined : l.href}
                    className={cx(menuItem, l.current && "text-primary")}
                  >
                    {l.label}
                  </MenuItem>
                ))}
              </Menu>
            </Popover>
          </MenuTrigger>
          <UserMenu />
        </div>
      </div>
      <div aria-hidden className="h-0.5 bg-[image:var(--gradient-hot)]" />
    </header>
  );
}

function UserMenu() {
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <MenuTrigger>
      <AriaButton
        aria-label={`Account menu for ${user.name}`}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full"
      >
        <span className="inline-flex size-9 rounded-full bg-[linear-gradient(135deg,#affc41,#d92b83)] p-0.5">
          <span className="flex flex-1 items-center justify-center rounded-full bg-raised text-xs font-bold text-text-strong">
            {initials(user.name)}
          </span>
        </span>
      </AriaButton>
      <Popover placement="bottom end" offset={8} className={popover}>
        <Menu aria-label="Account" className="outline-none" onAction={(key) => key === "sign-out" && signOut()}>
          <MenuSection>
            <Header className="px-3 pt-2 pb-3 text-sm">
              <span className="label block text-text-muted">Signed in as</span>
              <span className="mt-1 block font-bold text-text-strong">{user.name}</span>
              <span className="block text-text-muted">{user.email}</span>
            </Header>
          </MenuSection>
          <Separator className="mx-1 my-1 h-px bg-glass-border" />
          <MenuItem id="sign-out" className={menuItem}>
            <LogOutIcon size={18} />
            Sign out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
