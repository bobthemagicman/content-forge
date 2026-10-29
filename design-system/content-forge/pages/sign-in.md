# Sign-in Page Overrides (`/`)

> **PROJECT:** Content Forge
> **Page type:** Public landing / sign-in (FR-2, US1)

> Rules here **override** `design-system/content-forge/MASTER.md`. Only deviations are listed.

---

## Purpose

Show Content Forge branding, a one-line description, and one way in: Sign in with Google. Show no
catalog content, thumbnails, or metadata (FR-2). Sign-in errors appear here (`/?error=domain`,
`/?error=signin`).

## Layout overrides

- No app header. The wordmark sits top-left at the page gutter.
- Two columns at ≥ 1024px: left = headline, description, sign-in button, error area;
  right = a decorative brand panel: a glass panel (`--radius-xl`) holding a loose grid of empty
  rounded glass tiles, a few of them edged and glowing in the type accents, over a plum and lime
  glow. No thumbnails, no item names (FR-2). Stacks to one column below 1024px; the panel hides below 768px.
- Content vertically centered in the viewport, sized to content (no `100vh` hero).

## Typography overrides

- Eyebrow: a glass pill reading "Private asset library" (`--text-label`).
- Headline uses `--text-hero` (Aeonik 68/1.02, `#FFFFFF`), max 3 lines; its second phrase takes the
  `--gradient-hot` text fill.
- Description `--text-body-lg`, `#E5E5E5`, max 48ch.

## Component overrides

- **Sign in with Google** follows Google's sign-in branding guidelines (dark theme button: `#131314`
  fill, `#8E918F` 1px border, `#E3E3E3` text, full-color "G" logo), not the lime primary. It is the
  only action on the page, so the "one primary per view" rule holds. Height 44px, Google's
  "rectangular" shape (4px radius), not our pill, because the button must follow Google's branding
  rather than ours. No glow on it.
- **Error alert** (Master "Alert / banner", error variant) appears above the button with
  `role="alert"`:
  - `domain`: "That Google account can't sign in. Content Forge only accepts accounts on
    [allowed domain]. Sign in with a different account."
  - `signin`: "Sign-in didn't finish. Try again."
- A signed-in visitor is redirected to `/browse/`; never render the page for them.

## Copy

Direct and practical (brand voice): name the tool and what it's for in one sentence. No hype.
