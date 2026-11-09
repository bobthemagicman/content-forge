"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { BetaNotice } from "@/components/beta-notice";
import { FullPageLoading } from "@/components/full-page-loading";
import { AssetSessionBanner, AssetSessionProvider } from "@/lib/assets/asset-session";
import { useSession } from "@/lib/auth/session";
import { DEMO_MODE } from "@/lib/config";

/**
 * Signed-in shell (contracts/ui-routes.md "Global behavior"): nothing from the catalog renders until
 * there's a session and the asset cookies are set (T040), and a signed-out visitor goes back to `/`.
 * Client gating is for UX only; the backend enforces access (Principle II).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedOut") router.replace("/");
  }, [status, router]);

  if (status !== "signedIn") return <FullPageLoading />;

  return (
    <AssetSessionProvider>
      <a
        href="#main"
        className="label sr-only z-[100] rounded-full bg-raised px-5 py-3 text-text-strong focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AppHeader />
      {DEMO_MODE && <BetaNotice />}
      <main id="main" tabIndex={-1} className="outline-none">
        <AssetSessionBanner />
        {children}
      </main>
    </AssetSessionProvider>
  );
}
