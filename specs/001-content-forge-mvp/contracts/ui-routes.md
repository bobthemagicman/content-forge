# Contract: UI Routes & States (`content.example.com`)

**Provider**: `src/app/` (Next.js App Router, static export, `trailingSlash: true`)

Every route is a static HTML shell, and data loads on the client. Auth gating on the client is for
user experience only (Principle II). The backend enforces access (see [data-api.md](./data-api.md)
and [assets-cdn.md](./assets-cdn.md)).

| Route | File | Auth | Purpose | Stories |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Public | Landing: branding, description, "Sign in with Google", sign-in error message | US1 |
| `/auth/callback/` | `src/app/auth/callback/page.tsx` | Public | Completes the Cognito redirect. On success → `/browse/`. On `?error_description=` → `/?error=domain` (if it contains `PreSignUp`) or `/?error=signin` | US1 |
| `/browse/` | `src/app/(app)/browse/page.tsx` | Signed in | Category rows | US2 |
| `/browse/<type>/` | `src/app/(app)/browse/[type]/page.tsx` + `generateStaticParams` over the 6 types (lower-kebab: `website-templates`, `powerpoint-templates`, `video`, `images`, `textures`, `other`) | Signed in | "See all" grid | US7 |
| `/content/?slug=<slug>` | `src/app/(app)/content/page.tsx` (component that reads `useSearchParams` wrapped in `<Suspense>`) | Signed in | Detail page | US3, US5, US6 |
| `/404.html` | `src/app/not-found.tsx` | Public | Unknown paths (Amplify rewrite) | — |

## Global behavior

- **Signed-in layout** `src/app/(app)/layout.tsx` (client): `AuthProvider` → `AssetSessionProvider`
  → `AppHeader` + content.
  - With no Amplify session, it calls `router.replace('/')` and renders nothing from the catalog.
  - Until `/_session` succeeds, it shows a full-page skeleton.
- **Landing redirect**: `/` with an existing session calls `router.replace('/browse/')` (FR-004).
- **Sign-out** (header): `/_session/signout`, then Amplify `signOut()`, then `/`.
- **Navigation**: all links go through `next/link` or React Aria `href`. `RouterProvider` is wired to
  `useRouter().push`.

## Page states

| Page | Loading | Empty | Error | Not found |
|---|---|---|---|---|
| Browse | 3 skeleton rows × 6 skeleton cards, with fixed card aspect ratio (no layout shift) | "No content yet." when every row is empty. Each empty row is hidden | Inline retry banner per failed row | — |
| See all | Skeleton grid | "Nothing in <Type> yet." | Retry banner | Invalid type → `notFound()` (only at build time; static params are closed) |
| Detail | Skeleton header + preview block | — | Retry banner | Missing slug, no match, or `DRAFT` → "We couldn't find that item." + link to `/browse/` |

## Detail page action rules

| Condition | Download | Live Demo | Vendor demo |
|---|---|---|---|
| Any published item | ✔ | | |
| `type = WEBSITE_TEMPLATE` and `demoEntryPath` present | ✔ | ✔ (new tab) | |
| `demoEntryPath` absent and `externalDemoUrl` present | ✔ | | ✔ (new tab, `rel="noopener noreferrer"`) |

## Accessibility contract (Principle IV)

- Each category row is a React Aria `GridList` (`orientation="horizontal"`, `aria-label="<Type label>"`).
  It's one Tab stop, arrow keys move between cards, and Enter opens the item.
- Previous/next scroll buttons have `aria-label="Scroll <Type> left/right"` and are hidden from
  assistive tech when they can't scroll.
- The page has one `h1`. Row titles are `h2`. The detail page title is `h1`.
- Focus rings use the amber `#F2A524` color. Text never uses magenta `#D92B83` below large-text
  size; magenta text uses the `#EE77AE` tint. Styling follows `design-system/content-forge/`.
- `prefers-reduced-motion: reduce` turns off smooth scrolling and hover scale.
