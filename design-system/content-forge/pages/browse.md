# Browse Page Overrides (`/browse/`)

> **PROJECT:** Content Forge
> **Page type:** Catalog home, category rows (FR-3, US2)

> Rules here **override** `design-system/content-forge/MASTER.md`. Only deviations are listed.

---

## Purpose

Show every content type that has published items as one horizontally scrolling row, in this fixed
order: Website Templates, PowerPoint Templates, Video, Images, Textures, Other. Empty rows are hidden.

## Layout overrides

- **Hero** (above the rows, about 300px tall at ≥ 1024px):
  - left: `h1` "Browse" in `--text-hero` with the `--gradient-hot` text fill, then a lead line in
    Aeonik 28px `#FFFFFF` ("Your whole library, ready when you are."), then one sentence of body
    copy (`--text-body-lg`, max 52ch);
  - right: the Master "Jump tiles" grid (FR-010). Tiles hide below 768px, where the header's type
    menu does the same job.
  - It is not a featured-item banner: it shows no item, and nothing in it rotates.
- Rows follow the hero, separated by 56px. Row = Master "Category row" with its type accent.
  Card width 272px at ≥ 1280px, 240px at 768–1279px, 72% of the viewport at < 768px so the next
  card peeks in (signals scrolling).
- Row previous/next buttons are shown at ≥ 768px. On touch widths the row scrolls by swipe, and
  "See all" is the non-drag alternative.
- No item counts on the page: the data API pages rows 20 at a time and has no per-type total
  (contracts/data-api.md).

## Color overrides

- The page has no lime primary button. Lime appears as the active nav pill and as the accent of
  the lime-accent rows. The `h1` gradient is the only gradient text on the page.

## States (from the UI contract)

- **Loading:** the hero renders immediately (it needs no data; jump tiles show for all six types
  until rows resolve, then empty types drop out), plus 3 skeleton rows × 6 skeleton cards at the
  real card size.
- **Empty catalog:** Master "Empty state": "No content yet." The jump tiles hide.
- **Row error:** inline error alert in place of that row's cards, with a "Try again" quiet button.

## Avoid

- Hover-to-play video previews on cards (no autoplay).
- Featured-item banners, carousels that auto-advance, or promotional content.
