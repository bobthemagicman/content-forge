# See All Page Overrides (`/browse/<type>/`)

> **PROJECT:** Content Forge
> **Page type:** Single content type as a grid (US7)

> Rules here **override** `design-system/content-forge/MASTER.md`. Only deviations are listed.

---

## Purpose

Every published item of one content type as a plain grid, the keyboard- and touch-friendly
alternative to scrolling a row.

## Layout overrides

- Breadcrumb ("Browse / <Type>") above `h1` = the type label (`--text-h1`), preceded by the type's
  outlined index number (`--text-index`, `aria-hidden`). The page sets `--accent-rgb` to the type
  accent, and the background adds a soft glow in that accent at 0.12 alpha behind the heading.
- No item count (the data API has no per-type total).
- Grid: `repeat(auto-fill, minmax(240px, 1fr))`, gap 24px (16px below 768px). Two columns minimum
  at 375px.
- Cards are the Master "Asset card" unchanged (hover glow in the type accent); the grid is a React Aria `GridList` with
  `layout="grid"` so arrow keys move in two dimensions.
- Sort order: newest published first (`publishedAt` descending). No filter or sort controls in the
  MVP (search and filtering are out of scope).

## States

- **Loading:** skeleton grid (12 cards).
- **Empty:** "Nothing in <Type> yet." with a quiet "Back to Browse" link.
- **Error:** error alert with "Try again".
