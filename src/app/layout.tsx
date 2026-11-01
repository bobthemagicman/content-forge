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
    <html lang="en" className={`${aeonik.variable} ${lato.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
