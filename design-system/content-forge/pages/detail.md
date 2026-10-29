# Detail Page Overrides (`/content/?slug=<slug>`)

> **PROJECT:** Content Forge
> **Page type:** Single asset: preview, facts, download (FR-4 to FR-7; US3, US5, US6)

> Rules here **override** `design-system/content-forge/MASTER.md`. Only deviations are listed.

---

## Layout overrides

- Breadcrumb ("Browse / <Type> / <Title>").
- ≥ 1024px: two columns, preview 8/12 left, facts panel 4/12 right (panel is not sticky).
  Below 1024px: preview first, then the panel.
- Facts panel order: type badge (large accent pill) → `h1` title (`--text-display`, wraps, never
  truncated; the part before the first colon, if any, takes the gradient) → actions → stat tiles →
  metadata list → description (`--text-body-lg`, max 70ch) → tags.
- **Item glow:** the page background swaps the plum glow for a radial glow in the item's
  `accentColor` (data-model; computed at ingest, capped at relative luminance 0.2) at 0.16 alpha
  behind the preview, and the preview frame glows in the same color at 0.3. Missing `accentColor`
  → the type accent. Captions sit at least 16px below the frame.

## Actions (from the UI contract's action rules)

- **Download** is the page's one primary (lime) button, 52px, full panel width, with the primary
  glow; label includes the size: "Download · 48.2 MB". It requests a 5-minute signed URL; while waiting it shows a spinner and
  `aria-busy`, then the browser download starts.
- **Live demo** (website templates with a hosted demo): secondary button, opens a new tab.
- **Vendor demo** (no hosted demo, `externalDemoUrl` present): secondary button, new tab.
- Never more than one secondary next to Download.

## Metadata (FR-4)

Numeric facts go in the stat tiles (download size, then the type's counts: page count, slide
count, duration, or dimensions, then download count). Everything else goes in the metadata list.

Type, source marketplace (link to listing), license, original file name, download size, purchase
date, download count, plus type-specific facts:

| Type | Extra facts |
|---|---|
| Website template | Page count, demo variants |
| PowerPoint | Slide count, aspect ratio, deck file name |
| Video | Duration, resolution, frame rate, codec |
| Image / Texture | Dimensions, format |
| Other | File list (path + size), scrollable box, max 500 entries |

## Preview components (FR-7)

These follow FR-7 and tasks T108–T114; this file only adds the styling.

- **Screenshot gallery** (website templates, T108): React Aria `Tabs` "Desktop" / "Mobile" with the
  Master segmented-control look (lime-filled selected pill). The desktop panel shows the 1440×900
  screenshot at 16:10 in the Master browser frame; the mobile panel shows the 390×844 screenshot in
  the Master phone frame on a glowing glass field.
- **Slide gallery** (PowerPoint, T109): grid of up to 12 slides, `repeat(auto-fill, minmax(200px, 1fr))`,
  gap 16px, each slide a `--radius-md` glass frame that lifts on hover, labeled "Slide n of slideCount" in muted `--text-sm`. Activating a slide opens the
  Master "Dialog / lightbox".
- **Video** (T110): native `<video controls preload="metadata" playsInline poster=…>` in a glass
  frame with the item glow, click to play, no autoplay, captions track when available. Caption under it: "Preview clip · 30 s · 720p".
- **Image** (T111): fits the preview area; "Zoom" opens the lightbox. Panning uses
  `overflow: auto`; add + / − buttons so zoom never depends on pinch or wheel.
- **Texture** (T112): three `--radius-lg` panels side by side (stacked below 768px), each tiling the
  texture with `background-repeat: repeat` at 25%, 50%, and 100% scale. Each panel has a visible
  label in a glass pill over its corner ("25%", "50%", "100%") and an `aria-label` describing its
  scale.
- **Other** (T113): type icon and the file list instead of a picture.

## States

- **Loading:** skeleton header (badge, two title lines) + skeleton preview block at 16:10. The glow
  uses the type accent until the item loads.
- **Not found** (missing slug, no match, or draft): "We couldn't find that item." + quiet link
  "Back to Browse".
- **Download error:** error alert above the actions: what failed and "Try again".
