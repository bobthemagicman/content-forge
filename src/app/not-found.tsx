import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { LogoMark, SearchXIcon } from "@/components/icons";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/** Exported as 404.html; Amplify serves it for unknown paths (T052). */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page py-8">
        <div className="font-display flex items-center gap-3 text-xl text-text-strong">
          <LogoMark size={24} />
          <span>Content Forge</span>
        </div>
      </header>
      <main className="container-page flex flex-1 items-center pb-20">
        <EmptyState
          headingLevel={1}
          icon={<SearchXIcon size={32} />}
          title="This page doesn’t exist."
          action={
            <LinkButton href="/" variant="quiet" className="border border-glass-edge">
              Go to Content Forge
            </LinkButton>
          }
        >
          Check the address, or start again from the home page.
        </EmptyState>
      </main>
    </div>
  );
}
