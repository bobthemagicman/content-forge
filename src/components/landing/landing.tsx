"use client";

import { Roboto } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Button as AriaButton } from "react-aria-components";
import { GoogleLogo, LogoMark, TypeIcon } from "@/components/icons";
import { Banner } from "@/components/ui/banner";
import { useSession } from "@/lib/auth/session";
import { DEMO_MODE } from "@/lib/config";
import type { ContentType } from "@/lib/content-types";
import { ACCENT_RGB } from "@/lib/content-types";
import { cx } from "@/lib/cx";

// Google's sign-in branding asks for Roboto Medium on the button.
const roboto = Roboto({ subsets: ["latin"], weight: "500", display: "swap", preload: false });

const ERRORS: Record<string, { title: string; body: string }> = {
  domain: {
    title: "That Google account can’t sign in.",
    body: "Content Forge only accepts accounts on its allowed Google Workspace domain. Sign in with a different account.",
  },
  signin: { title: "Sign-in didn’t finish.", body: "Try again." },
};

/** Public landing (pages/sign-in.md, T047): branding, one sentence, one way in. No catalog data. */
export function Landing() {
  const { status, signIn } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedIn") router.replace("/browse/");
  }, [status, router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page py-8">
        <div className="font-display flex items-center gap-3 text-xl text-text-strong">
          <LogoMark size={24} />
          <span>Content Forge</span>
        </div>
      </header>
      <main className="container-page flex flex-1 flex-wrap items-center gap-16 pt-4 pb-20">
        <div className="flex max-w-[640px] flex-[1_1_480px] flex-col items-start gap-6">
          <span className="glass label inline-flex items-center gap-2.5 rounded-full px-3.5 py-2 text-text">
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            Private asset library
          </span>
          <h1 className="text-[clamp(44px,6vw,68px)] leading-[1.02] tracking-[-0.02em]">
            Everything you&rsquo;ve bought, <span className="text-gradient">in one place.</span>
          </h1>
          <p className="max-w-[48ch] text-body-lg text-text">
            Browse, preview, and download the templates, decks, footage, and textures you already own, before you buy
            them again.
          </p>
          <Suspense>
            <SignInError />
          </Suspense>
          <div className="flex flex-col items-start gap-3 pt-1">
            <AriaButton
              onPress={signIn}
              isDisabled={status === "loading"}
              className={cx(
                roboto.className,
                "inline-flex h-11 cursor-pointer items-center gap-3 rounded-[4px] border border-[#8e918f] bg-[#131314] pr-4 pl-3 text-sm text-[#e3e3e3]",
                "data-hovered:bg-[#1f1f22] data-pressed:bg-[#2a2a2e]",
              )}
            >
              <GoogleLogo size={20} />
              Sign in with Google
            </AriaButton>
            <p className="text-sm text-text-muted">
              {DEMO_MODE
                ? "Beta preview: sign-in is simulated and opens a sample catalog."
                : "Use your Google Workspace account."}
            </p>
          </div>
        </div>
        <BrandPanel />
      </main>
    </div>
  );
}

function SignInError() {
  const code = useSearchParams().get("error");
  const error = code ? ERRORS[code] : undefined;
  if (!error) return null;
  return (
    <Banner title={error.title} className="max-w-[520px]">
      {error.body}
    </Banner>
  );
}

const GLOW_TILES: Record<number, ContentType> = { 1: "WEBSITE_TEMPLATE", 6: "VIDEO", 9: "TEXTURE", 14: "IMAGE" };

/** Decorative panel of empty glass tiles, a few glowing in the type accents. Shows no content (FR-002). */
function BrandPanel() {
  return (
    <div
      aria-hidden
      className="glass hidden aspect-square max-w-[600px] flex-[1_1_440px] grid-cols-4 gap-3.5 rounded-xl bg-[radial-gradient(closest-side_at_70%_30%,rgb(175_252_65/0.1),transparent),radial-gradient(closest-side_at_25%_80%,rgb(217_43_131/0.16),transparent)] p-7 md:grid"
    >
      {Array.from({ length: 16 }, (_, n) => {
        const type = GLOW_TILES[n];
        const rgb = type && ACCENT_RGB[type];
        return (
          <div
            key={n}
            className="flex items-center justify-center rounded-md border border-white/8 bg-glass"
            style={
              rgb
                ? {
                    borderColor: `rgb(${rgb} / 0.55)`,
                    background: `radial-gradient(closest-side, rgb(${rgb} / 0.22), transparent), rgb(255 255 255 / 0.04)`,
                    boxShadow: `0 18px 50px -20px rgb(${rgb} / 0.7)`,
                    color: `rgb(${rgb})`,
                  }
                : undefined
            }
          >
            {type && <TypeIcon type={type} size={28} />}
          </div>
        );
      })}
    </div>
  );
}
