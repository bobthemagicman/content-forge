# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/content-forge/pages/<page-name>.md`.
> If that file exists, its rules **override** this Master file.
> If not, follow the rules below.

---

**Project:** Content Forge (internal tooling)
**Direction:** **Afterglow**, chosen by the owner on 2026-10-28 over a flatter baseline and a
brutalist "Index" option. Comps: [Content Forge Comps](https://claude.ai/artifact/YFjWAqUQQiZZZWjmJgK1t7).
**Scaffolded:** 2026-10-28 with ui-ux-pro-max (`--design-system --persist`, category News/Media Platform,
dials Variance 4 / Motion 3 / Density 6). The generated palette and fonts did not match the brand and
were replaced by hand. Contrast ratios below were computed, not estimated.

### Sources, in order of precedence

1. **Entropy Forge brand standards** (Confluence, Sales, Marketing & Branding space):
   [Corporate Brand & Marketing Standards](https://entropy-forge.atlassian.net/wiki/spaces/MB/pages/23887875/Corporate+Brand+Marketing+Standards)
   and its child page
   [Visual Standards — Do & Don't Examples](https://entropy-forge.atlassian.net/wiki/spaces/MB/pages/23625733/Visual+Standards+Do+Don+t+Examples).
   Colors, color roles (lime primary CTA, magenta secondary, amber callouts), and fonts come from there.
2. **This file.** It extends the brand standards (which cover marketing) into a system for
   internal tools: dark UI, components, states, accessibility.
3. **Page overrides** in `pages/`.

**Deliberate departures from the brand standards.** The standards ask for restraint and one hot
color per visual moment. Afterglow is an internal tool, and the owner chose a more expressive look
for it. These departures are intentional and apply to Content Forge only:

| Brand standard | Afterglow |
|---|---|
| One hot color per visual moment | Each content type has its own accent (lime, amber, or pink), so several can share a screen. Still **one lime button** per view |
| Flat, no gradients | One gradient (`--gradient-hot`) for display text, the header hairline, and the avatar ring. Soft radial glows in the page background |
| No glow or shadows | Colored glows for elevation and hover (`--shadow-glow-*`) |
| Square corners | Rounded: 12–18px panels, pill buttons |

The project constitution (Principle IV, Accessible by Default) applies on top of all three. It
requires WCAG 2.1 AA; this system targets WCAG 2.2 AA, which includes everything in 2.1 AA plus
newer criteria (focus not obscured, target size, dragging alternatives, accessible
authentication). Where a style rule and AA conflict, AA wins and this file records the adjustment.

---

## Principles

- **Content glows, chrome recedes.** A deep plum-black ground with soft colored light makes
  thumbnails and previews the brightest things on screen. Panels are translucent glass, not boxes.
- **Color means type.** Every content type has one accent, used for its row number, card dot,
  hover glow, and jump tile. Accents are decoration and wayfinding, never the only signal.
- **One primary action per view.** Exactly one lime button in any screen region, and it is the only
  element with a lime glow.
- **Motion is feedback.** Things lift and glow when you point at them, and settle when you leave.
  Nothing moves on its own, and everything is still under reduced motion.
- **Dark-first.** There is no light theme in the MVP.
- **Predictable patterns.** The same component looks and behaves the same on every page.

---

## Color

### Brand primitives (from the brand standards, plus the site's plum)

| Name | Hex | Role in Afterglow |
|---|---|---|
| Lime | `#AFFC41` | Primary CTA, active nav, selected tab. Accent for Website Templates and Images |
| Magenta | `#D92B83` | Secondary button border and fill, link underlines, background glow |
| Pink (magenta tint) | `#EE77AE` | Magenta *text* (AA adjustment). Accent for Video and Other |
| Amber | `#F2A524` | Focus ring, callouts, success. Accent for PowerPoint and Textures |
| Plum | `#3C1642` | Background glow (from entropy-forge.io) |
| Dark neutral | `#303030` | Text on lime |
| Light neutral | `#E5E5E5` | Body text on dark |

### Semantic tokens (dark theme)

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#0B0710` | Page ground, under the glows |
| `--color-glass` | `rgb(255 255 255 / 0.04)` | Cards, panels, tiles, tags (≈ `#15111A` over `bg`) |
| `--color-glass-hover` | `rgb(255 255 255 / 0.07)` | Hovered card or tile |
| `--color-glass-border` | `rgb(255 255 255 / 0.09)` | Panel edges (decorative, not a control boundary) |
| `--color-raised` | `#1A1220` | Menus, popovers, dialogs, browser/phone frames (opaque) |
| `--color-header` | `rgb(11 7 16 / 0.6)` + 18px backdrop blur | Sticky header (solid `#0B0710` fallback when blur is unsupported) |
| `--color-control-border` | `#777777` | Input and checkbox boundaries |
| `--color-text-strong` | `#FFFFFF` | Headings |
| `--color-text` | `#E5E5E5` | Body text |
| `--color-text-muted` | `#AAAAAA` | Metadata, captions, placeholders |
| `--color-primary` | `#AFFC41` | Primary button fill, selected tab fill |
| `--color-primary-hover` | `#9EE83A` | Primary hover |
| `--color-primary-pressed` | `#8FD62F` | Primary pressed |
| `--color-on-primary` | `#303030` | Text and icons on lime |
| `--color-primary-tint` | `rgb(175 252 65 / 0.12)` + border `rgb(175 252 65 / 0.45)` | Active nav pill, type badge on the detail page (lime text on it: 12.7) |
| `--color-secondary` | `#D92B83` | Secondary button border and hover fill, link underlines |
| `--color-secondary-tint` | `rgb(217 43 131 / 0.08)` | Secondary button rest fill |
| `--color-secondary-text` | `#EE77AE` | Magenta *text* on dark |
| `--color-on-secondary` | `#FFFFFF` | Text on a magenta fill |
| `--color-callout` | `#F2A524` | Callout/success icon and text |
| `--color-focus` | `#F2A524` | Focus ring (all interactive elements) |
| `--color-danger` | `#FF6B6B` | Error text and icons, destructive actions |
| `--color-scrim` | `rgb(11 7 16 / 0.75)` | Behind dialogs |

**Type accents** (`--accent` per content type; set as an RGB triple, `--accent-rgb`, so glows can
use alpha):

| Type | Accent |
|---|---|
| Website Templates, Images | Lime `#AFFC41` (`175 252 65`) |
| PowerPoint Templates, Textures | Amber `#F2A524` (`242 165 36`) |
| Video, Other | Pink `#EE77AE` (`238 119 174`) |

**Gradient and glow:**

- `--gradient-hot`: `linear-gradient(95deg, #AFFC41 0%, #F2A524 55%, #EE77AE 100%)`. Used for
  display text (`background-clip: text`), the 2px header hairline, and the avatar ring. Nowhere else.
- Page background: `bg` plus three radial glows: plum `rgb(60 22 66 / 0.95)` top-left, magenta
  `rgb(217 43 131 / 0.2)` top-right, lime `rgb(175 252 65 / 0.06)` mid-right.
- Detail pages replace the plum glow with one in the item's own `accentColor` (data-model;
  computed at ingest and capped at relative luminance 0.2) at 0.16 alpha behind the preview,
  falling back to the type accent. The preview frame's glow uses the same color at 0.3.

### Contrast (WCAG 2.1 ratio, computed)

`glass` and `glass on plum` are the composited colors (`#15111A`, `#441F4A`). `plum` is the
brightest point of the background glow, so it is the worst case for text over the page ground.

| Foreground | on `bg` #0B0710 | on plum glow #3C1642 | on `glass` | on glass over plum | on `raised` #1A1220 |
|---|---|---|---|---|---|
| text-strong `#FFFFFF` | 20.0 | 15.2 | 18.6 | 13.6 | 18.2 |
| text `#E5E5E5` | 15.8 | 12.0 | 14.8 | 10.8 | 14.5 |
| text-muted `#AAAAAA` | 8.6 | 6.5 | 8.0 | 5.9 | 7.9 |
| lime `#AFFC41` | 16.0 | 12.1 | 14.9 | 10.9 | 14.6 |
| amber `#F2A524` | 9.7 | 7.3 | 9.0 | 6.6 | 8.8 |
| pink `#EE77AE` | 7.5 | 5.7 | 7.0 | 5.1 | 6.8 |
| magenta `#D92B83` | 4.4 | **3.3** | 4.1 | **3.0** | 4.0 |
| danger `#FF6B6B` | 7.2 | 5.5 | 6.7 | 4.9 | 6.6 |
| control-border `#777777` | 4.5 | 3.4 | 4.2 | 3.0 | 4.1 |

Fills: `#303030` on lime 10.6 (hover 8.8, pressed 7.4). `#FFFFFF` on magenta 4.5. Lime text on
`primary-tint` 12.7. Pink text on `secondary-tint` 7.1. Item glows, worst case (any color at the
0.2 luminance cap, page glow 0.16 and frame glow 0.3 stacked): muted text 5.0 or better.

### Color rules

- **Magenta is never text.** `#D92B83` text falls to 3.0–4.4:1. Magenta text uses `#EE77AE`;
  `#D92B83` is for borders, fills, underlines, and glows.
- **Gradient text only at 32px and up**, and its lowest stop (pink) still clears 5:1 everywhere.
  Never gradient body text, labels, or links.
- **Accents never color running text.** They color numbers, dots, borders, glows, and large
  display text.
- **Focus is amber; selected is lime.** A focused item never looks selected.
- **Glows are decoration.** No information depends on a glow, so contrast rules don't apply to
  them, but no glow may sit behind text at more than the alphas above.
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
| `--text-hero` | 68 / 1.02, `-0.02em` | Aeonik | Browse `h1` and sign-in headline. Gradient allowed |
| `--text-display` | 48 / 1.05, `-0.015em` | Aeonik | Detail-page `h1`. First phrase may take the gradient |
| `--text-h1` | 36 / 1.15 | Aeonik | `h1` on See all and utility pages |
| `--text-h2` | 30 / 1.15 | Aeonik | Row titles, section titles |
| `--text-index` | 56 / 1, outlined | Aeonik | Row numbers (`01`…), 1px stroke in the type accent, transparent fill, `aria-hidden` |
| `--text-stat` | 32–44 / 1 | Aeonik | Stat tiles and jump-tile numerals, tabular |
| `--text-h3` | 18 / 1.3 | Aeonik | Card group titles, dialog titles |
| `--text-body-lg` | 18 / 1.6 | Lato 400 | Descriptions on detail pages |
| `--text-body` | 16 / 1.5 | Lato 400 | Default |
| `--text-card` | 15 / 1.4 | Lato 700 | Card titles |
| `--text-sm` | 14 / 1.45 | Lato 400 | Metadata values, captions |
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
- Sticky header height 72px plus a 2px gradient hairline; set `scroll-padding-top: 96px` so focus is never hidden under it
  (WCAG 2.2 2.4.11).

### Shape and depth

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Logo mark, small chips |
| `--radius-md` | 12px | Thumbnails, inputs, alerts |
| `--radius-lg` | 16px | Cards, preview frames, stat tiles |
| `--radius-xl` | 18px | Panels, jump tiles, dialogs |
| `--radius-full` | 999px | Buttons, tabs, nav items, badges, tags, avatars, icon buttons |

| Token | Value | Use |
|---|---|---|
| `--shadow-glow-primary` | `0 14px 40px -12px rgb(175 252 65 / 0.7)` | The primary button only (hover: `0 18px 50px -12px` at 0.85) |
| `--shadow-glow-accent` | `0 22px 60px -24px rgb(var(--accent-rgb) / 0.8)` | Hovered card or tile |
| `--shadow-glow-preview` | `0 40px 120px -30px <accentColor at 0.3>` | Detail preview frame |

- Depth comes from glass over glow, not grey steps. Opaque `raised` is for things that float
  (menus, dialogs) so text under them never shows through.
- Panel borders are 1px `glass-border`. Selected states are lime fills or lime-tint pills.
  Focus rings are 2px amber with a 3px offset (4px on cards so the ring clears the lift).

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

- Durations: 200ms (hover, lift, glow), 300–350ms (thumbnail zoom, tile glow growth), 150ms (exit).
  Easing `ease` for lifts, `cubic-bezier(0.2, 0, 0, 1)` for color.
- Allowed: `transform: translateY(-4px…-6px)` lift on cards, tiles, and the primary button;
  `scale(1.03)` on a thumbnail inside its card (clipped, so layout never moves); glow and color
  changes. The download arrow bobs while the primary button is hovered.
- Not allowed: scroll-reveal, parallax, GSAP timelines, anything that starts without user input
  and runs longer than 5s (WCAG 2.2.2). A pulse may run at most 3 times.
- `prefers-reduced-motion: reduce`: no transforms, no animations, no smooth row scrolling; color
  and glow changes become instant.
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

All buttons are pills (`--radius-full`).

| Variant | Rest | Hover | Pressed | Disabled |
|---|---|---|---|---|
| **Primary** | Fill lime, text `#303030`, `--shadow-glow-primary` | Fill `#9EE83A`, lift 2px, stronger glow, icon bobs | Fill `#8FD62F`, no lift | Fill `#1C1821`, text `#AAAAAA`, no glow |
| **Secondary** | Fill `secondary-tint`, 1px border `#D92B83`, text `#EE77AE` | Fill `#D92B83`, text `#FFFFFF` | Fill `#B71F6C`, text `#FFFFFF` | Border `glass-border`, text `#AAAAAA` |
| **Quiet** | Transparent, text `#E5E5E5` | Fill `glass-hover` | Fill `rgb(255 255 255 / 0.1)` | Text `#AAAAAA` |
| **Danger** | Transparent, 1px border `#FF6B6B`, text `#FF6B6B` | Fill `#FF6B6B`, text `#111111` | — | As secondary |

- Label: `--text-label` (Aeonik, uppercase, 0.12em; 13px on the 52px primary). Heights: primary
  52px on detail pages, otherwise 44px; 36px compact (desktop toolbars only). Padding 20px.
- One primary per view region; it is the only lime-glowing element there.
- Focus: 2px amber ring, 3px offset, on every variant.
- Links that open a new tab show a trailing `external-link` icon and add "(opens in new tab)" to the
  accessible name.

### Icon button

Round, 44 × 44px: `glass` fill, 1px `rgb(255 255 255 / 0.14)` border, `#E5E5E5` icon. Hover:
`rgb(var(--accent-rgb) / 0.15)` fill and accent border (the row's accent, or lime outside rows).
Disabled: `#777777` icon. Required `aria-label`, tooltip on hover and focus.

### Text link

Lato, `#E5E5E5`, underline 1px `#D92B83` offset 3px. Hover: text `#FFFFFF`, underline 2px.
"See all" links are the exception: no underline, a trailing arrow that slides 4px on hover.

### Type badge

Pill, `--text-label`, `#AAAAAA` text, preceded by a 6px dot in the type accent. On cards it has no
fill. On the detail page it is the larger lime-tint pill (`primary-tint`, lime text, 12.7:1) for
lime-accent types, and the same pattern in the type's accent otherwise. One badge per card. Values:
Website Template, PowerPoint, Video, Image, Texture, Other.

### Tag

Glass pill: `glass` fill, `glass-border`, Lato 14px `#E5E5E5`, padding 6px 14px. Not interactive in
the MVP (search and filtering are out of scope), so no hover state.

### Asset card (`GridListItem`)

- Glass panel (`--radius-lg`, padding 10px 10px 16px) holding the thumbnail, title, and badge.
- Thumbnail at a fixed **16:10** aspect ratio (no layout shift), `--radius-md`, `object-fit:
  cover`, `glass` fill while loading.
- Title `--text-card` `#FFFFFF`, max 2 lines, wraps; badge below.
- Hover: card lifts 6px, `glass-hover` fill, border and glow in the row accent, thumbnail scales
  1.03 inside its clip. Video cards: the play disc fills with the accent and the triangle turns
  dark. Focus-visible: 2px amber ring, 4px offset, around the whole card.
- Accessible name = title + type. Thumbnail `alt` = "<title> preview" (FR-7; Principle IV requires
  meaningful alt text on every image).

### Category row (`GridList`, `orientation="horizontal"`)

- Sets `--accent-rgb` for everything inside it.
- Header: outlined index number (`--text-index`, `aria-hidden`), `h2` title, "See all" link, then
  the round previous/next icon buttons right-aligned. Never over the thumbnails.
- One Tab stop per row; arrow keys move between cards; Enter opens.
- Previous/next: `aria-label="Scroll <Type> left/right"`, disabled and hidden from assistive tech
  when they can't scroll. They are the non-drag alternative (WCAG 2.5.7).
- The scroller has 8px top and 16px bottom padding so lifted cards and glows aren't clipped, and
  `scroll-padding-inline` equal to the gutter so a focused card is never cut off.

### Header

72px, `--color-header` (translucent + blur), 2px `--gradient-hot` hairline along the bottom.
Left: logo mark (rounded square in the gradient) and wordmark, linking to `/browse/`. Then the
type nav as pills: rest `#E5E5E5`, hover `glass-hover` fill, current = `primary-tint` pill with lime
text and `aria-current="page"`. Right: user menu (`MenuTrigger`: initials in a gradient ring →
"Signed in as …", "Sign out"). Below 1024px the type nav moves into a menu button (the seven
pills don't fit on one line at tablet widths).

### Jump tiles (Browse, FR-010)

A 3 × 2 grid of glass tiles (`--radius-xl`, min-height 132px), one per type that has items, in row
order. Each tile shows the type's icon and name, and a soft glow orb in the type accent in its
top-right corner that grows on hover. It links to its row (`#row-<routeSlug>`). The grid is a
`nav` labelled "Jump to a type".

### Stat tiles and metadata

- **Stat tiles:** a 2-column grid of small glass tiles (`--radius-lg`): value in `--text-stat`
  `#FFFFFF`, label below in `--text-sm` muted. Markup is a `dl` (`dd` shown first visually).
  Use for the 2–4 numeric facts of a type (size, pages/slides/duration, variants, downloads).
- **Metadata list:** the remaining facts as key/value rows separated by 1px `glass-border` lines;
  keys `--text-label` muted, values `--text-sm` right-aligned with tabular numbers. Source
  marketplace is a text link to the original listing (new tab).

### Alert / banner

Glass fill, `--radius-md`, 1px border in the status color, leading icon, title + one sentence + an
action. Error: `#FF6B6B`, `role="alert"`. Info/success: amber icon and border, `role="status"`.
Never a full accent fill.

### Skeleton

`glass` blocks with the real radii at the exact size of what they replace (card: 16:10 box + two
text lines). Optional opacity pulse 0.6 ↔ 1 over 1.2s; static under reduced motion. Container has
`aria-busy="true"` and a visually hidden "Loading…".

### Preview frames

- **Desktop screenshot:** a browser frame (`raised`, `--radius-lg`, 40px title bar with three dots
  and the demo path in a muted pill) with `--shadow-glow-preview`.
- **Mobile screenshot:** a phone frame (40px outer radius, 10px bezel, 30px screen radius, notch)
  centered on a glass field with a radial glow.
- **Slides, video, image, texture:** inside a plain glass frame (`--radius-lg`) with the same glow.

### Dialog / lightbox (`Modal` + `Dialog`)

`raised` fill, `--radius-xl`, 1px `glass-border`, scrim `rgb(11 7 16 / 0.75)` with an 8px backdrop
blur, close icon button top-right, focus trapped and returned to the trigger. Image zoom uses this
with keyboard zoom controls (+ / − buttons, not only pinch or wheel).

### Segmented control (`ToggleButtonGroup`, or `Tabs` styled the same way)

A pill track (`glass` fill, `glass-border`, 4px padding) holding pill buttons 40px tall. Selected =
lime fill, `#303030` text. Unselected = transparent, `#E5E5E5` text, `glass-hover` on hover. Used
for the Desktop / Mobile screenshot tabs.

### Form fields (for future internal tools: admin, tagging)

`TextField`/`SearchField`: label above (Aeonik label style), input 44px, `--radius-md`, `glass`
fill, 1px `#777777` border (3:1 or better on every surface; glass borders are too faint for a
control), text `#E5E5E5`, placeholder `#AAAAAA`. Focus: amber 2px ring. Error: border and
message `#FF6B6B` with icon, message below the field, linked with `aria-describedby`. Never
placeholder-only labels. Paste always allowed.

### Empty and not-found states

Centered in a glass panel: Lucide icon 32px in a soft accent glow, `h2`, one sentence, one action (quiet or
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
  --color-bg: #0b0710;
  --color-glass: rgb(255 255 255 / 0.04);
  --color-glass-hover: rgb(255 255 255 / 0.07);
  --color-glass-border: rgb(255 255 255 / 0.09);
  --color-raised: #1a1220;
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
  --color-plum: #3c1642;

  --font-display: var(--font-aeonik), "Lato", Arial, sans-serif;
  --font-sans: var(--font-lato), Arial, sans-serif;

  --radius-*: initial; /* replace Tailwind's scale with ours */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 18px;
  --radius-full: 999px;

  --shadow-*: initial; /* only the glows below */
  --shadow-glow-primary: 0 14px 40px -12px rgb(175 252 65 / 0.7);
  --shadow-glow-accent: 0 22px 60px -24px rgb(var(--accent-rgb) / 0.8);
}

:root {
  --accent-rgb: 175 252 65;
  --gradient-hot: linear-gradient(95deg, #affc41 0%, #f2a524 55%, #ee77ae 100%);
}
[data-type="powerpoint-templates"], [data-type="textures"] { --accent-rgb: 242 165 36; }
[data-type="video"], [data-type="other"] { --accent-rgb: 238 119 174; }

html { font-synthesis: none; background: var(--color-bg); color: var(--color-text); }
body {
  background:
    radial-gradient(1100px 700px at 8% -8%, rgb(60 22 66 / 0.95), transparent 70%),
    radial-gradient(800px 600px at 100% 4%, rgb(217 43 131 / 0.2), transparent 70%),
    radial-gradient(900px 700px at 70% 55%, rgb(175 252 65 / 0.06), transparent 70%),
    var(--color-bg);
}
```

---

## Accessibility checklist (WCAG 2.2 AA)

- Text ≥ 4.5:1, large text and non-text UI ≥ 3:1 (see the contrast table; magenta is never text).
- Glass and blur have solid fallbacks (`@supports not (backdrop-filter: blur(1px))` → `#0B0710` header), and text stays AA in `forced-colors` mode, where glows and gradients drop out.
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

- More than one lime button, or more than one lime glow, in one region.
- Magenta `#D92B83` text; gradient or accent-colored body text, labels, or links.
- Gradients other than `--gradient-hot` and the documented background glows; gradient fills on
  buttons or panels.
- Glass over glass with blur (stacked `backdrop-filter`); blur anywhere but the header and scrim.
- Grey drop shadows; glows on more than the hovered element.
- Motion that starts by itself and keeps going; scroll-reveal; parallax; hover-only affordances.
- Emoji or icon fonts as icons.
- Placeholder-only labels; color-only status.
- Loading Aeonik from any third-party host.

## Pre-delivery checklist

- [ ] Tokens only: no raw hex values in components.
- [ ] One primary (lime) action per region; type accents come from `--accent-rgb`, never hard-coded.
- [ ] Every interactive element is a React Aria component or native element with a visible amber focus state.
- [ ] Contrast pairs taken from the table above.
- [ ] Images reserve space (fixed aspect ratio); lazy-loaded below the fold.
- [ ] Reduced motion honored: no lifts, zooms, bobs, or pulses.
- [ ] Header and dialogs checked with and without `backdrop-filter`, and in forced-colors mode.
- [ ] Checked at 375, 768, 1024, 1440 and at 200% zoom.
- [ ] axe-core run passes (Playwright).
