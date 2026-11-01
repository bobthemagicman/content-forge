// Draws the beta preview's demo assets into public/demo/v/<id>/ from each catalog item's `art`:
// thumbnails, website screenshots, slides, posters, image previews, texture tiles, a hosted demo
// page, and (when ffmpeg is installed) short preview clips. Output is deterministic, so re-running
// it only changes files whose art changed.
//
// Usage: npm run demo:assets            (needs Node 24 for TypeScript type stripping)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_ITEMS } from "../../src/lib/data/demo/catalog.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outRoot = join(root, "public", "demo", "v");

// ------------------------------------------------------------------ helpers

/** Small seeded PRNG (mulberry32) so speckle patterns are identical on every run. */
function rng(seedText) {
  let seed = [...seedText].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svg = (w, h, body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  (defs ? `<defs>${defs}</defs>` : "") +
  body +
  "</svg>\n";
const rect = (x, y, w, h, fill, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const circle = (cx, cy, r, fill, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
const text = (x, y, size, fill, content, extra = "") =>
  `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="${fill}"${extra}>${content}</text>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shortName(title) {
  return title.split(/[:(,]/)[0].trim();
}

// ------------------------------------------------------------------ website templates

function webThumb({ bg, accent, ink }) {
  const W = 1280, H = 800;
  return svg(W, H, [
    rect(0, 0, W, H, bg),
    rect(80, 64, 190, 36, accent, ' rx="6"'),
    ...[0, 1, 2].map((i) => rect(860 + i * 120, 74, 90, 16, ink, ' rx="8" opacity="0.5"')),
    rect(80, 220, 780, 64, ink, ' rx="8"'),
    rect(80, 310, 560, 64, ink, ' rx="8"'),
    rect(80, 410, 470, 22, ink, ' rx="11" opacity="0.45"'),
    rect(80, 476, 220, 64, accent, ' rx="32"'),
    ...[0, 1, 2].map((i) => rect(80 + i * 380, 600, 340, 140, ink, ' rx="14" opacity="0.12"')),
  ].join(""));
}

function webDesktop({ bg, accent, ink }, title) {
  const W = 1440, H = 900;
  const name = esc(shortName(title));
  return svg(W, H, [
    rect(0, 0, W, H, bg),
    rect(96, 40, 40, 40, accent, ' rx="10"'),
    text(150, 70, 24, ink, name, ' font-weight="700"'),
    ...["Features", "Pricing", "About", "Contact"].map((l, i) => text(820 + i * 120, 68, 18, ink, l, ' opacity="0.7"')),
    rect(1300, 40, 44, 44, ink, ' rx="22" opacity="0.12"'),
    text(96, 250, 72, ink, "Build something", ' font-weight="700"'),
    text(96, 335, 72, accent, "people remember.", ' font-weight="700"'),
    rect(96, 380, 520, 18, ink, ' rx="9" opacity="0.35"'),
    rect(96, 410, 460, 18, ink, ' rx="9" opacity="0.35"'),
    rect(96, 470, 200, 60, accent, ' rx="30"'),
    text(140, 508, 20, bg, "Get started", ' font-weight="700"'),
    rect(316, 470, 180, 60, "none", ` rx="30" stroke="${ink}" stroke-opacity="0.4" stroke-width="2"`),
    text(356, 508, 20, ink, "Learn more"),
    rect(800, 160, 544, 400, ink, ' rx="24" opacity="0.08"'),
    rect(840, 200, 464, 60, accent, ' rx="12" opacity="0.85"'),
    ...[0, 1, 2].map((i) => rect(840, 290 + i * 76, 464 - i * 80, 48, ink, ' rx="10" opacity="0.14"')),
    ...[0, 1, 2].flatMap((i) => [
      rect(96 + i * 424, 640, 400, 200, ink, ' rx="20" opacity="0.07"'),
      rect(128 + i * 424, 672, 56, 56, accent, ' rx="14"'),
      rect(128 + i * 424, 752, 260, 18, ink, ' rx="9" opacity="0.7"'),
      rect(128 + i * 424, 786, 200, 14, ink, ' rx="7" opacity="0.35"'),
    ]),
  ].join(""));
}

function webMobile({ bg, accent, ink }, title) {
  const W = 390, H = 844;
  const name = esc(shortName(title));
  return svg(W, H, [
    rect(0, 0, W, H, bg),
    rect(24, 64, 28, 28, accent, ' rx="8"'),
    text(62, 85, 18, ink, name, ' font-weight="700"'),
    ...[0, 1, 2].map((i) => rect(330, 70 + i * 8, 28, 3, ink, ' rx="1.5"')),
    text(24, 190, 38, ink, "Build", ' font-weight="700"'),
    text(24, 236, 38, ink, "something", ' font-weight="700"'),
    text(24, 282, 38, accent, "memorable.", ' font-weight="700"'),
    rect(24, 312, 320, 12, ink, ' rx="6" opacity="0.35"'),
    rect(24, 334, 260, 12, ink, ' rx="6" opacity="0.35"'),
    rect(24, 376, 342, 54, accent, ' rx="27"'),
    text(136, 410, 17, bg, "Get started", ' font-weight="700"'),
    rect(24, 460, 342, 220, ink, ' rx="20" opacity="0.08"'),
    rect(48, 484, 294, 44, accent, ' rx="10" opacity="0.85"'),
    ...[0, 1].map((i) => rect(48, 548 + i * 56, 294 - i * 60, 36, ink, ' rx="8" opacity="0.14"')),
    ...[0, 1].map((i) => rect(24, 704 + i * 70, 342, 56, ink, ' rx="14" opacity="0.07"')),
  ].join(""));
}

function webDemoPage({ bg, accent, ink }, title) {
  const name = esc(shortName(title));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${name} · Live demo</title>
<style>
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; background: ${bg}; color: ${ink}; }
  header, main, footer { max-width: 1120px; margin: 0 auto; padding: 24px; }
  header { display: flex; align-items: center; gap: 12px; }
  .logo { width: 32px; height: 32px; border-radius: 8px; background: ${accent}; }
  nav { margin-left: auto; display: flex; gap: 24px; }
  nav a { color: inherit; opacity: 0.75; text-decoration: none; }
  h1 { font-size: clamp(40px, 7vw, 72px); line-height: 1.05; margin: 64px 0 16px; }
  h1 span { color: ${accent}; }
  p { font-size: 18px; line-height: 1.6; max-width: 56ch; opacity: 0.8; }
  .cta { display: inline-block; margin-top: 16px; padding: 16px 28px; border-radius: 999px; background: ${accent}; color: ${bg}; font-weight: 700; text-decoration: none; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin: 72px 0; }
  .card { padding: 24px; border-radius: 20px; background: color-mix(in srgb, ${ink} 7%, transparent); }
  .card i { display: block; width: 48px; height: 48px; border-radius: 12px; background: ${accent}; margin-bottom: 16px; }
  footer { opacity: 0.6; font-size: 14px; }
</style>
</head>
<body>
<header><div class="logo"></div><strong>${name}</strong>
  <nav><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#contact">Contact</a></nav></header>
<main>
  <h1>Build something<br><span>people remember.</span></h1>
  <p>This is a stand-in live demo generated for the Content Forge beta preview. The real catalog hosts each
  template's own files here, unzipped from the purchase.</p>
  <a class="cta" href="#features">Get started</a>
  <section id="features" class="grid">
    <div class="card"><i></i><h2>Fast</h2><p>Plain HTML and CSS, no build step.</p></div>
    <div class="card"><i></i><h2>Flexible</h2><p>Nine page layouts, light and dark.</p></div>
    <div class="card"><i></i><h2>Friendly</h2><p>Accessible components and clear docs.</p></div>
  </section>
</main>
<footer>Demo content · ${name}</footer>
</body>
</html>
`;
}

// ------------------------------------------------------------------ PowerPoint slides

function slideBody(kind, { bg, accent, ink }, W, H, title) {
  const name = esc(shortName(title));
  const pad = W * 0.07;
  const head = (t) => text(pad, H * 0.17, H * 0.065, ink, esc(t), ' font-weight="700"');
  switch (kind) {
    case "title":
      return [
        rect(0, 0, W * 0.012, H, accent),
        text(pad, H * 0.45, H * 0.1, ink, name, ' font-weight="700"'),
        rect(pad, H * 0.52, W * 0.32, H * 0.025, ink, ' opacity="0.45"'),
        rect(pad, H * 0.8, W * 0.12, H * 0.02, accent),
      ];
    case "bars": {
      const vals = [0.35, 0.6, 0.45, 0.85, 0.7, 0.55];
      const bw = (W - pad * 2) / vals.length;
      return [
        head("Revenue by quarter"),
        ...vals.map((v, i) => rect(pad + i * bw + bw * 0.15, H * 0.88 - H * 0.6 * v, bw * 0.7, H * 0.6 * v, accent, i === 3 ? "" : ' opacity="0.55"')),
        rect(pad, H * 0.88, W - pad * 2, 2, ink, ' opacity="0.3"'),
      ];
    }
    case "kpis":
      return [
        head("Highlights"),
        ...["+42%", "3.1M", "98%"].flatMap((v, i) => [
          rect(pad + i * (W - pad * 2) / 3, H * 0.32, (W - pad * 2) / 3 - 24, H * 0.5, ink, ' rx="16" opacity="0.06"'),
          text(pad + 32 + i * (W - pad * 2) / 3, H * 0.56, H * 0.12, accent, v, ' font-weight="700"'),
          rect(pad + 32 + i * (W - pad * 2) / 3, H * 0.65, W * 0.15, H * 0.025, ink, ' opacity="0.4"'),
        ]),
      ];
    case "bullets":
      return [
        head("Agenda"),
        ...[0, 1, 2, 3, 4].flatMap((i) => [
          circle(pad + 12, H * (0.33 + i * 0.12), 10, accent),
          rect(pad + 44, H * (0.33 + i * 0.12) - H * 0.018, W * (0.5 - i * 0.04), H * 0.036, ink, ' opacity="0.55"'),
        ]),
      ];
    case "split":
      return [
        rect(W * 0.52, 0, W * 0.48, H, accent, ' opacity="0.9"'),
        circle(W * 0.76, H * 0.5, H * 0.22, bg, ' opacity="0.35"'),
        head("Our approach"),
        ...[0, 1, 2].map((i) => rect(pad, H * (0.34 + i * 0.09), W * 0.36, H * 0.03, ink, ' opacity="0.45"')),
      ];
    case "timeline":
      return [
        head("Roadmap"),
        rect(pad, H * 0.55, W - pad * 2, 4, ink, ' opacity="0.35"'),
        ...[0, 1, 2, 3, 4].flatMap((i) => [
          circle(pad + i * (W - pad * 2) / 4, H * 0.55, 18, i < 3 ? accent : bg, ` stroke="${accent}" stroke-width="4"`),
          rect(pad - 40 + i * (W - pad * 2) / 4, H * 0.64, 80, H * 0.03, ink, ' opacity="0.45"'),
        ]),
      ];
    case "quote":
      return [
        text(pad, H * 0.4, H * 0.3, accent, "“", ' font-weight="700"'),
        rect(pad, H * 0.45, W * 0.7, H * 0.05, ink, ' opacity="0.75"'),
        rect(pad, H * 0.54, W * 0.55, H * 0.05, ink, ' opacity="0.75"'),
        rect(pad, H * 0.7, W * 0.2, H * 0.03, accent),
      ];
    default: // team
      return [
        head("The team"),
        ...[0, 1, 2, 3].flatMap((i) => [
          circle(pad + 80 + i * (W - pad * 2) / 4, H * 0.48, H * 0.1, accent, ' opacity="0.8"'),
          rect(pad + 20 + i * (W - pad * 2) / 4, H * 0.66, 120, H * 0.03, ink, ' opacity="0.55"'),
        ]),
      ];
  }
}

const SLIDE_KINDS = ["title", "bars", "kpis", "bullets", "split", "timeline", "quote", "team"];

function slide(art, n, aspect, title) {
  const [W, H] = aspect === "4:3" ? [1200, 900] : [1600, 900];
  const kind = SLIDE_KINDS[(n - 1) % SLIDE_KINDS.length];
  return svg(W, H, rect(0, 0, W, H, art.bg) + slideBody(kind, art, W, H, title).join(""));
}

function pptThumb(art, aspect, title) {
  const W = 1280, H = 800;
  const sw = aspect === "4:3" ? 760 : 1060;
  const sh = aspect === "4:3" ? 570 : 596;
  const x = (W - sw) / 2, y = (H - sh) / 2;
  const [SW, SH] = aspect === "4:3" ? [1200, 900] : [1600, 900];
  return svg(W, H, [
    rect(0, 0, W, H, "#1A1220"),
    `<g transform="translate(${x} ${y}) scale(${sw / SW} ${sh / SH})">`,
    rect(0, 0, SW, SH, art.bg),
    ...slideBody("bars", art, SW, SH, title),
    "</g>",
  ].join(""));
}

// ------------------------------------------------------------------ video

function videoScene({ sky, ground, sun }, W, H) {
  return [
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${sun}" stop-opacity="0.6"/></linearGradient>`,
    [
      rect(0, 0, W, H, "url(#sky)"),
      circle(W * 0.3, H * 0.42, H * 0.1, sun),
      `<path d="M0 ${H * 0.62} Q ${W * 0.25} ${H * 0.5} ${W * 0.5} ${H * 0.6} T ${W} ${H * 0.56} V ${H} H 0 Z" fill="${ground}" opacity="0.75"/>`,
      `<path d="M0 ${H * 0.72} Q ${W * 0.35} ${H * 0.62} ${W * 0.65} ${H * 0.7} T ${W} ${H * 0.68} V ${H} H 0 Z" fill="${ground}"/>`,
    ].join(""),
  ];
}

function videoFrame(art, W, H) {
  const [defs, body] = videoScene(art, W, H);
  return svg(W, H, body, defs);
}

function renderClip(art, file) {
  // An abstract, slowly drifting gradient in the item's colors: 6 s, 640×360, silent.
  const hex = (c) => `0x${c.replace("#", "")}`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi",
    "-i", `gradients=s=640x360:d=6:r=24:n=3:speed=0.015:c0=${hex(art.sky)}:c1=${hex(art.ground)}:c2=${hex(art.sun)}`,
    "-vf", "vignette=PI/5,format=yuv420p",
    "-c:v", "libx264", "-preset", "veryslow", "-crf", "32", "-movflags", "+faststart", "-an",
    file,
  ]);
}

// ------------------------------------------------------------------ images

function imageArt({ bg, shape, block }, W, H) {
  return svg(W, H, [
    rect(0, 0, W, H, "url(#light)"),
    circle(W * 0.78, H * 0.18, W * 0.35, shape, ' opacity="0.95"'),
    rect(W * 0.1, H * 0.44, W * 0.34, H * 0.56, block, ' rx="8"'),
    rect(W * 0.5, H * 0.66, W * 0.22, H * 0.34, shape, ' opacity="0.55" rx="8"'),
  ].join(""),
  `<radialGradient id="light" cx="0.3" cy="0.25" r="0.9"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${shape}" stop-opacity="0.6"/></radialGradient>`);
}

// ------------------------------------------------------------------ textures

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  return `#${[ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** A seamless S×S tile as SVG markup (no outer <svg>). */
function texturePattern({ pattern, base }, S, seed) {
  const r = rng(seed);
  const parts = [rect(0, 0, S, S, base)];
  const wrapDots = (count, rMin, rMax, colorFor) => {
    for (let i = 0; i < count; i++) {
      const x = r() * S, y = r() * S, rad = rMin + r() * (rMax - rMin), fill = colorFor(i);
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        if (x + dx + rad < 0 || x + dx - rad > S || y + dy + rad < 0 || y + dy - rad > S) continue;
        parts.push(circle((x + dx).toFixed(1), (y + dy).toFixed(1), rad.toFixed(1), fill));
      }
    }
  };
  switch (pattern) {
    case "concrete":
      wrapDots(900, 0.6, 2.4, () => shade(base, (r() - 0.5) * 0.18));
      wrapDots(18, 3, 7, () => shade(base, -0.12));
      break;
    case "kraft":
      wrapDots(1400, 0.4, 1.3, () => shade(base, (r() - 0.55) * 0.22));
      break;
    case "terrazzo": {
      const chips = ["#C0563C", "#2F4B5A", "#8C8C84", "#D9A07A"];
      wrapDots(140, 2, 9, (i) => chips[i % chips.length]);
      wrapDots(500, 0.5, 1.5, () => shade(base, -0.1));
      break;
    }
    case "wood": {
      let x = 0;
      while (x < S) {
        const w = 2 + r() * 9;
        parts.push(rect(x.toFixed(1), 0, w.toFixed(1), S, shade(base, (r() - 0.45) * 0.14)));
        x += w;
      }
      for (let i = 0; i < 6; i++) parts.push(rect((r() * S).toFixed(1), 0, 1, S, shade(base, -0.12)));
      break;
    }
    case "steel":
      for (let y = 0; y < S; y += 2) parts.push(rect(0, y, S, 2, shade(base, (r() - 0.5) * 0.12)));
      break;
    case "slate": {
      const t = S / 4;
      for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 4; gy++)
        parts.push(rect(gx * t + 3, gy * t + 3, t - 6, t - 6, shade(base, (r() - 0.5) * 0.12), ' rx="2"'));
      for (let i = 0; i <= 4; i++) {
        parts.push(rect(i * t - 3, 0, 6, S, "#1C1F22"));
        parts.push(rect(0, i * t - 3, S, 6, "#1C1F22"));
      }
      break;
    }
  }
  return parts.join("");
}

function textureTile(art, seed) {
  const S = 512;
  return svg(S, S, texturePattern(art, S, seed));
}

function textureThumb(art, seed) {
  const W = 1280, H = 800, S = 512;
  return svg(W, H, rect(0, 0, W, H, "url(#t)"),
    `<pattern id="t" width="${S}" height="${S}" patternUnits="userSpaceOnUse">${texturePattern(art, S, seed)}</pattern>`);
}

// ------------------------------------------------------------------ main

let clips = 0;
const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

rmSync(outRoot, { recursive: true, force: true });

for (const item of DEMO_ITEMS) {
  const { art, id, title } = item;
  if (art.kind === "other") continue;
  const dir = join(outRoot, id);
  mkdirSync(dir, { recursive: true });
  const write = (name, content) => writeFileSync(join(dir, name), content);

  switch (art.kind) {
    case "web":
      write("thumb.svg", webThumb(art));
      write("desktop.svg", webDesktop(art, title));
      write("mobile.svg", webMobile(art, title));
      if (item.demoEntryPath) {
        mkdirSync(join(dir, "demo"), { recursive: true });
        write(join("demo", item.demoEntryPath), webDemoPage(art, title));
      }
      break;
    case "ppt": {
      const { slideCount, aspectRatio } = item.meta;
      write("thumb.svg", pptThumb(art, aspectRatio, title));
      for (let n = 1; n <= Math.min(12, slideCount); n++)
        write(`slide-${String(n).padStart(2, "0")}.svg`, slide(art, n, aspectRatio, title));
      break;
    }
    case "video":
      write("thumb.svg", videoFrame(art, 1280, 800));
      write("poster.svg", videoFrame(art, 1280, 720));
      if (hasFfmpeg) {
        renderClip(art, join(dir, "preview.mp4"));
        clips++;
      }
      break;
    case "image":
      write("thumb.svg", imageArt(art, 1280, 800));
      write("preview.svg", imageArt(art, 2048, 1365));
      break;
    case "texture":
      write("thumb.svg", textureThumb(art, id));
      write("tile.svg", textureTile(art, id));
      break;
  }
}

console.log(`Demo assets written to ${outRoot}`);
if (!hasFfmpeg) console.warn("ffmpeg not found: video preview clips were not generated.");
else console.log(`${clips} preview clips rendered.`);
if (!existsSync(outRoot)) process.exit(1);
