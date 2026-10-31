import { Lato } from "next/font/google";
import localFont from "next/font/local";

// Aeonik is licensed and git-ignored; scripts/fonts/ensure-fonts.mjs supplies a Lato stand-in when
// the real files are absent (CI, forks). Only Regular exists, so bold is never requested.
export const aeonik = localFont({
  src: [
    { path: "./fonts/Aeonik-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Aeonik-Regular.woff", weight: "400", style: "normal" },
  ],
  variable: "--font-aeonik",
  display: "swap",
});

export const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
});
