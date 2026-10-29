# Browse Page Overrides (`/browse/`)

> **PROJECT:** Content Forge
> **Page type:** Catalog home, category rows (FR-3, US2)

> Rules here **override** `design-system/content-forge/MASTER.md`. Only deviations are listed.

---

## Purpose

Show every content type that has published items as one horizontally scrolling row, in this fixed
order: Website Templates, PowerPoint Templates, Video, Images, Textures, Other. Empty rows are hidden.

## Layout overrides

- Page `h1` "Browse" (`--text-h1`), then rows separated by `--space-12`.
- Row = Master "Category row". Card width 280px at ≥ 1280px, 240px at 768–1279px, 72% of the
  viewport at < 768px so the next card peeks in (signals scrolling).
- Row previous/next buttons are shown at ≥ 768px. On touch widths the row scrolls by swipe, and
  "See all" is the non-drag alternative.

## Color overrides

- The page has no lime primary button. Lime appears only as the active type in the header nav.
  This keeps the thumbnails as the brightest things on screen.

## States (from the UI contract)

- **Loading:** 3 skeleton rows × 6 skeleton cards at the real card size.
- **Empty catalog:** Master "Empty state": "No content yet."
- **Row error:** inline error alert in place of that row's cards, with a "Try again" quiet button.

## Avoid

- Hover-to-play video previews on cards (no autoplay).
- Featured heroes, carousels that auto-advance, or promotional banners.
