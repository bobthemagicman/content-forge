# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/content-forge/pages/<page-name>.md`.
> If that file exists, its rules **override** this Master file.
> If not, follow the rules below.

---

**Project:** Content Forge (internal tooling)
**Scaffolded:** 2026-10-28 with ui-ux-pro-max (`--design-system --persist`, category News/Media Platform,
dials Variance 4 / Motion 3 / Density 6). The generated palette, fonts, shadows, and radii did not
match the brand and were replaced by hand. Contrast ratios below were computed, not estimated.

### Sources, in order of precedence

1. **Entropy Forge brand standards** (Confluence, Sales, Marketing & Branding space):
   [Corporate Brand & Marketing Standards](https://entropy-forge.atlassian.net/wiki/spaces/MB/pages/23887875/Corporate+Brand+Marketing+Standards)
   and its child page
   [Visual Standards — Do & Don't Examples](https://entropy-forge.atlassian.net/wiki/spaces/MB/pages/23625733/Visual+Standards+Do+Don+t+Examples).
   Color roles, CTA styles, and the "one hot color" rule come from there.
2. **This file.** It extends the brand standards (which cover marketing) into a system for
   internal tools: dark UI, components, states, accessibility.
3. **Page overrides** in `pages/`.

The project constitution (Principle IV, Accessible by Default) applies on top of all three. It
requires WCAG 2.1 AA; this system targets WCAG 2.2 AA, which includes everything in 2.1 AA plus
newer criteria (focus not obscured, target size, dragging alternatives, accessible
authentication). Where a brand rule and AA conflict, AA wins and this file records the adjustment.

---

## Principles

- **Restraint is a feature.** Visuals should feel deliberate, reliable, engineered (brand standards).
- **One hot color per visual moment.** Lime, magenta, and amber never compete in the same
  view region. Lime marks the one thing to do; everything else is neutral.
- **One primary action per view.** Exactly one lime button in any screen region.
- **Dark-first.** The tool is used to look at thumbnails and previews; a near-black ground keeps
  the content brightest. There is no light theme in the MVP.
- **Content over chrome.** Flat surfaces, square corners, no shadows, no gradients, no glow.
- **Predictable patterns.** The same component looks and behaves the same on every page.

---

## Color

### Brand primitives (from the brand standards)

| Name | Hex | Brand role |
|---|---|---|
| Lime | `#AFFC41` | Primary CTAs, key highlights, active states. Never long text or large fills |
| Magenta | `#D92B83` | Secondary CTAs, underlines, interaction cues |
| Amber | `#F2A524` | Callouts, success states, informational emphasis. Sparingly |
| Dark neutral | `#303030` | Structure; text on lime |
| Light neutral | `#E5E5E5` | Body text on dark |

### Semantic tokens (dark theme)

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#111111` | Page background |
| `--color-surface` | `#222222` | Cards, rows, panels, inputs |
| `--color-raised` | `#303030` | Header, menus, popovers, dialogs, hover fill |
| `--color-border` | `#3A3A3A` | Decorative dividers only (not a control boundary) |
| `--color-control-border` | `#777777` | Input and checkbox boundaries on `bg`/`surface` |
| `--color-text-strong` | `#FFFFFF` | Headings |
| `--color-text` | `#E5E5E5` | Body text |
| `--color-text-muted` | `#AAAAAA` | Metadata, captions, placeholders |
| `--color-primary` | `#AFFC41` | Primary button fill, active/selected indicator |
| `--color-primary-hover` | `#9EE83A` | Primary hover ("subtle darken") |
| `--color-primary-pressed` | `#8FD62F` | Primary pressed |
| `--color-on-primary` | `#303030` | Text and icons on lime |
| `--color-secondary` | `#D92B83` | Secondary button border, hover fill, badges, underlines |
| `--color-secondary-text` | `#EE77AE` | Magenta *text* on dark (AA adjustment, see below) |
| `--color-on-secondary` | `#FFFFFF` | Text on a magenta fill |
| `--color-callout` | `#F2A524` | Callout/success icon and text, info banners |
| `--color-focus` | `#F2A524` | Focus ring (all interactive elements) |
| `--color-danger` | `#FF6B6B` | Error text and icons, destructive actions |
| `--color-scrim` | `rgb(0 0 0 / 0.7)` | Behind dialogs |

### Contrast (WCAG 2.1 ratio, computed)

| Foreground | on `bg` #111111 | on `surface` #222222 | on `raised` #303030 |
|---|---|---|---|
| text-strong `#FFFFFF` | 18.9 | 15.9 | 13.2 |
| text `#E5E5E5` | 15.0 | 12.6 | 10.5 |
| text-muted `#AAAAAA` | 8.1 | 6.8 | 5.7 |
| primary lime `#AFFC41` | 15.1 | 12.7 | 10.6 |
| callout / focus amber `#F2A524` | 9.2 | 7.7 | 6.4 |
| secondary magenta `#D92B83` | 4.2 | 3.5 | **2.9** |
| secondary-text `#EE77AE` | 7.1 | 6.0 | 5.0 |
| danger `#FF6B6B` | 6.8 | 5.7 | 4.8 |
| control-border `#777777` | 4.2 | 3.6 | **2.9** |

Fills: `#303030` on lime 10.6 (hover 8.8, pressed 7.4). `#FFFFFF` on magenta 4.5.

### Color rules

- **Magenta is never small text on dark.** `#D92B83` text is 4.2:1 or lower on every dark surface,
  which fails AA. Magenta *text* uses `--color-secondary-text` `#EE77AE`; `#D92B83` is for
  borders, fills, and underlines.
- **On `raised` surfaces**, magenta borders and `#777777` control borders drop to 2.9:1 (below the
  3:1 non-text minimum). Use `--color-secondary-text` for secondary borders there, and don't put
  inputs on `raised`.
- **Focus is amber, active is lime.** Keeping them different means a focused item never looks
  selected. This is the only place amber appears alongside lime.
- **Accents never color body text or large areas.** No accent-filled sections or banners.
- **Error is never signaled by color alone**: always an icon plus words.

---

## Typography

| Role | Font | Notes |
|---|---|---|
| Display and headings | **Aeonik** Regular (400) | Licensed. Self-hosted through `next/font/local` from `src/app/fonts/Aeonik-Regular.woff2` (woff fallback). The files are git-ignored (public repo); builds fetch them from private S3, and CI uses a Lato stand-in (tasks T026, T029). Only Regular exists, so set `font-synthesis: none` and never request bold |
| Body, UI text | **Lato** 400 / 700 | `next/font/google` downloads it at build time and self-hosts it (works with static export; no runtime request to Google) |
| Labels, buttons, eyebrows | Aeonik Regular, UPPERCASE | Letter-spacing `0.12em`. Brand pattern from the website |
| Large light display | Lato 300 | Only at 32px and larger. Thin strokes break down on dark at small sizes |

Fallback stacks: `"Aeonik", "Lato", Arial, sans-serif` and `"Lato", Arial, sans-serif`.

### Type scale

| Token | Size / line-height | Font | Use |
|---|---|---|---|
| `--text-display` | 48 / 1.1 | Aeonik | Sign-in headline only |
| `--text-h1` | 36 / 1.15 | Aeonik | One per page |
| `--text-h2` | 24 / 1.25 | Aeonik | Row titles, section titles |
| `--text-h3` | 18 / 1.3 | Aeonik | Card group titles, dialog titles |
| `--text-body-lg` | 18 / 1.6 | Lato 400 | Descriptions on detail pages |
| `--text-body` | 16 / 1.5 | Lato 400 | Default |
| `--text-sm` | 14 / 1.45 | Lato 400 | Card titles, metadata values |
| `--text-label` | 12 / 1.2, `0.12em`, uppercase | Aeonik | Buttons, badges, eyebrows, metadata keys |

Rules: headings use `text-wrap: balance`; running text max ~70ch; numbers that line up (sizes,
counts, durations) use `font-variant-numeric: tabular-nums`; nothing smaller than 12px.

---

## Space, layout, shape

### Spacing (4px base, density 6/10)

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Icon-to-text in tight controls |
| `--space-2` | 8px | Inline gaps, badge padding |
| `--space-3` | 12px | Card internal padding |
| `--space-4` | 16px | Default gap, mobile gutter |
| `--space-6` | 24px | Component groups, tablet gutter |
| `--space-8` | 32px | Between page sections |
| `--space-12` | 48px | Desktop gutter, between rows |
| `--space-16` | 64px | Page top/bottom padding |

### Layout

- Container: fluid, `max-width: 1440px`, side gutters 16px (< 768px), 24px (768–1279px), 48px (≥ 1280px).
- Breakpoints: 375, 768, 1024, 1280, 1440. Mobile-first.
- The page body never scrolls sideways. Only category rows scroll horizontally, inside their own box.
- Sticky header height 64px; set `scroll-padding-top: 80px` so focus is never hidden under it
  (WCAG 2.2 2.4.11).

### Shape and depth

- **Radius: 0 everywhere.** Square buttons, inputs, cards, dialogs, badges. (Avatars may be circles.)
- **No shadows.** Depth comes from surface steps: `bg` → `surface` → `raised`.
- Borders are 1px. Selected/active indicators are 2px lime; focus rings are 2px amber with a 2px offset.

### Layers (z-index)

| Token | Value | Use |
|---|---|---|
| `--z-base` | 0 | Content |
| `--z-row-controls` | 10 | Row previous/next buttons |
| `--z-header` | 40 | Sticky header |
| `--z-popover` | 100 | Menus, tooltips |
| `--z-dialog` | 1000 | Dialog + scrim |

---

## Motion

- Durations: 150ms (hover, press), 200ms (enter), 150ms (exit). Easing `cubic-bezier(0.2, 0, 0, 1)`.
- Animate only `color`, `background-color`, `border-color`, `opacity`. No transforms that move layout,
  no scale on hover, no scroll-reveal, no GSAP.
- `prefers-reduced-motion: reduce`: turn off smooth row scrolling and all transitions longer than 0ms
  except opacity fades.
- Video never autoplays. Nothing auto-rotates.

---

## Icons

- **Lucide** (SVG, stroke 1.75), sizes 16 / 20 / 24, color `currentColor`. No emoji, no icon fonts.
- Decorative icons get `aria-hidden="true"`. Icon-only buttons get an `aria-label`.

---

## Components

All interactive components are **React Aria Components** styled with Tailwind using the tokens above.
State styling uses React Aria's data attributes (`data-hovered`, `data-pressed`, `data-focus-visible`,
`data-selected`, `data-disabled`), never `:hover` alone.

### Button (`Button`, `Link` styled as a button)

| Variant | Rest | Hover | Pressed | Disabled |
|---|---|---|---|---|
| **Primary** | Fill lime, text `#303030`, no border | Fill `#9EE83A` | Fill `#8FD62F` | Fill `#303030`, text `#AAAAAA` |
| **Secondary** | Transparent, 1px border `#D92B83`, text `#EE77AE` | Fill `#D92B83`, text `#FFFFFF` | Fill `#B71F6C`, text `#FFFFFF` | Border `#3A3A3A`, text `#AAAAAA` |
| **Quiet** | Transparent, text `#E5E5E5` | Fill `#303030` | Fill `#3A3A3A` | Text `#AAAAAA` |
| **Danger** | Transparent, 1px border `#FF6B6B`, text `#FF6B6B` | Fill `#FF6B6B`, text `#111111` | — | As secondary |

- Label: `--text-label` (Aeonik, uppercase, 0.12em). Height 44px (default) or 36px (compact, desktop
  toolbars only). Horizontal padding 20px. Icon gap 8px.
- One primary per view region. A secondary is never larger than the primary beside it.
- Focus: 2px amber ring, 2px offset, on every variant.
- Links that open a new tab show a trailing `external-link` icon and add "(opens in new tab)" to the
  accessible name.

### Icon button

44 × 44px (36 × 36 compact), Quiet styling, required `aria-label`, tooltip on hover and focus.

### Text link

Lato, `#E5E5E5`, underline 1px `#D92B83` offset 3px (brand: magenta underlines are interaction cues).
Hover: text `#FFFFFF`, underline 2px.

### Type badge

`--text-label` (Aeonik, 12px uppercase), padding 4px 8px, `raised` fill `#303030`, text `#E5E5E5`
(10.5:1), 1px `#3A3A3A` border. Neutral on purpose: a badge sits on every card, and a magenta badge
would put a second hot color next to the lime active state. One badge per card. Values: Website
Template, PowerPoint, Video, Image, Texture, Other.

### Tag

Lato 14px, `#E5E5E5` on `surface`, 1px `#3A3A3A` border, padding 4px 10px. Not interactive in the MVP
(search and filtering are out of scope), so no hover state.

### Asset card (`GridListItem`)

- Thumbnail at a fixed **16:10** aspect ratio (no layout shift), `object-fit: cover`, `surface` fill
  while loading.
- Below: title (`--text-sm`, Lato 700, `#FFFFFF`, max 2 lines, wraps, never truncates mid-word without
  the full title in the accessible name) and type badge.
- Hover: thumbnail border 2px `#3A3A3A` → `#777777`; title underline. Focus-visible: 2px amber ring
  around the whole card. No scale, no lift.
- Accessible name = title + type. Thumbnail `alt` = "<title> preview" (FR-7; Principle IV requires
  meaningful alt text on every image).

### Category row (`GridList`, `orientation="horizontal"`)

- `h2` title + item count (muted) + "See all" text link, then the scrolling row.
- One Tab stop per row; arrow keys move between cards; Enter opens.
- Previous/next icon buttons (44px, `raised` fill) right-aligned in the row header, never over the
  thumbnails, `aria-label="Scroll <Type> left/right"`, disabled and hidden from assistive tech when
  they can't scroll. They are the non-drag alternative (WCAG 2.5.7).
- `scroll-padding-inline` equal to the gutter so a focused card is never clipped.

### Header

64px, `raised` fill, 1px `#3A3A3A` bottom border. Left: wordmark (links to `/browse/`). Center/left:
type nav (text links; active type has a 2px lime underline and `aria-current="page"`). Right: user
menu (`MenuTrigger`: avatar initials → "Signed in as …", "Sign out"). Below 768px the type nav moves
into a menu button.

### Metadata list

`<dl>` in a 2-column grid: keys in `--text-label` muted, values in `--text-sm` `#E5E5E5` with tabular
numbers. Source marketplace value is a text link to the original listing (new tab).

### Alert / banner

`surface` fill, 1px border in the status color, leading icon, title + one sentence + an action.
Error: `#FF6B6B`, `role="alert"`. Info/success: amber icon and border, `role="status"`.
Never a full accent fill.

### Skeleton

`surface` blocks at the exact size of what they replace (card: 16:10 box + two text lines).
Optional opacity pulse 0.6 ↔ 1 over 1.2s; static under reduced motion. Container has
`aria-busy="true"` and a visually hidden "Loading…".

### Dialog / lightbox (`Modal` + `Dialog`)

`raised` fill, no radius, scrim `rgb(0 0 0 / 0.7)`, close icon button top-right, focus trapped and
returned to the trigger. Image zoom uses this with keyboard zoom controls (+ / − buttons, not only
pinch or wheel).

### Segmented control (`ToggleButtonGroup`, or `Tabs` styled the same way)

Used for small view switches such as the Desktop / Mobile screenshot tabs. Buttons share 1px `#777777`
borders; selected = lime 2px bottom bar + `#FFFFFF` text; unselected `#AAAAAA` text.

### Form fields (for future internal tools: admin, tagging)

`TextField`/`SearchField`: label above (Aeonik label style), input 44px, `surface` fill, 1px
`#777777` border, text `#E5E5E5`, placeholder `#AAAAAA`. Focus: amber 2px ring. Error: border and
message `#FF6B6B` with icon, message below the field, linked with `aria-describedby`. Never
placeholder-only labels. Paste always allowed.

### Empty and not-found states

Centered in the content area: Lucide icon 32px muted, `h2`, one sentence, one action (quiet or
secondary button, never primary unless it's the only action on the page).

---

## Tailwind v4 mapping

Fonts load in `src/app/fonts.ts` (task T029) and expose CSS variables on `<html>`:

```ts
import localFont from 'next/font/local';
import { Lato } from 'next/font/google';

export const aeonik = localFont({
  src: [
    { path: './fonts/Aeonik-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Aeonik-Regular.woff', weight: '400', style: 'normal' },
  ],
  variable: '--font-aeonik',
  display: 'swap',
});

export const lato = Lato({ subsets: ['latin'], weight: ['300', '400', '700'], variable: '--font-lato', display: 'swap' });
```

```css
@import "tailwindcss";

@theme {
  --color-bg: #111111;
  --color-surface: #222222;
  --color-raised: #303030;
  --color-border: #3a3a3a;
  --color-control-border: #777777;
  --color-text-strong: #ffffff;
  --color-text: #e5e5e5;
  --color-text-muted: #aaaaaa;
  --color-primary: #affc41;
  --color-primary-hover: #9ee83a;
  --color-primary-pressed: #8fd62f;
  --color-on-primary: #303030;
  --color-secondary: #d92b83;
  --color-secondary-pressed: #b71f6c;
  --color-secondary-text: #ee77ae;
  --color-callout: #f2a524;
  --color-focus: #f2a524;
  --color-danger: #ff6b6b;

  --font-display: var(--font-aeonik), "Lato", Arial, sans-serif;
  --font-sans: var(--font-lato), Arial, sans-serif;

  --radius-*: initial; /* square corners: removes the default radius scale */
  --shadow-*: initial; /* no shadows */
}

html { font-synthesis: none; background: var(--color-bg); color: var(--color-text); }
```

---

## Accessibility checklist (WCAG 2.2 AA)

- Text ≥ 4.5:1, large text and non-text UI ≥ 3:1 (see the contrast table; respect the `raised` exceptions).
- Visible amber focus ring on every interactive element; never `outline: none` without a replacement.
- Focus not obscured by the sticky header (2.4.11).
- Pointer targets ≥ 24 × 24px (2.5.8); primary controls 44px.
- Dragging has a button alternative (2.5.7): row previous/next, zoom +/−.
- Accessible authentication (3.3.8): Google sign-in only, no cognitive tests.
- One `h1` per page; row titles `h2`.
- Errors announced (`role="alert"`) and described in words with a way forward.
- `prefers-reduced-motion` honored; no autoplay; no auto-rotation.
- Works at 320px wide and 200% zoom without horizontal page scroll.

## Anti-patterns (do not use)

- More than one hot color in one region; more than one lime button in one region.
- Magenta `#D92B83` text on dark; accent-colored paragraphs or section fills.
- Rounded corners, shadows, gradients, glow, glassmorphism, animated borders.
- Hover-only affordances; scale/translate hover effects; scroll-reveal animations.
- Emoji or icon fonts as icons.
- Placeholder-only labels; color-only status.
- Loading Aeonik from any third-party host.

## Pre-delivery checklist

- [ ] Tokens only: no raw hex values in components.
- [ ] One primary (lime) action per region; one hot color per region.
- [ ] Every interactive element is a React Aria component or native element with a visible amber focus state.
- [ ] Contrast pairs taken from the table above.
- [ ] Images reserve space (fixed aspect ratio); lazy-loaded below the fold.
- [ ] Reduced motion honored.
- [ ] Checked at 375, 768, 1024, 1440 and at 200% zoom.
- [ ] axe-core run passes (Playwright).
