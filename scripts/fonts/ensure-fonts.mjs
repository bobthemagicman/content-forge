// Aeonik is licensed and git-ignored (the repo is public). Amplify builds fetch the real files from
// FONTS_S3_URI before building. Anywhere else (CI, forks, fresh clones) this copies Lato 400 into
// the Aeonik paths as a stand-in so `next/font/local` always finds its files (task T029).
import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fontsDir = join(root, "src", "app", "fonts");
const lato = dirname(createRequire(import.meta.url).resolve("@fontsource/lato/package.json"));

for (const ext of ["woff2", "woff"]) {
  const target = join(fontsDir, `Aeonik-Regular.${ext}`);
  if (existsSync(target)) continue;
  copyFileSync(join(lato, "files", `lato-latin-400-normal.${ext}`), target);
  console.warn(`ensure-fonts: Aeonik-Regular.${ext} not found; using Lato 400 as a stand-in.`);
}
