import type { Metadata, Viewport } from "next";
import { aeonik, lato } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Content Forge", template: "%s · Content Forge" },
  description: "A private library of purchased website templates, decks, video, images, and textures.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0710",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions add attributes to <html> before React loads. This ignores attribute
    // differences on this element only; mismatches anywhere below are still reported.
    <html lang="en" className={`${aeonik.variable} ${lato.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
