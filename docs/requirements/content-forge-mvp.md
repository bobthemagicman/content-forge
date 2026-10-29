# Requirements: Content Forge — MVP

**Status**: Approved for planning (v5) · **Date**: 2026-10-27 · **Owner**: Justen L. Britain · **Repo**: `bobthemagicman/content-forge`

## Revision History
| Version | Change |
|---|---|
| v1 | Initial draft (Next.js SSR on Lambda via OpenNext, Auth.js, CDK). |
| v2 | Switched to a **static front-end** (Next.js `output: 'export'`) on **AWS Amplify Gen 2**. Auth moved to **Cognito + Google** because Auth.js needs a server. Next.js App Router confirmed (no React Router). DynamoDB only for the MVP; Aurora deferred. Domain `example.com`, region `us-west-2`. Thumbnails/previews are generated at ingest. Search is out of the MVP. Added branding. |
| v3 | Resolved open questions: PowerPoints are stored only as the original zip plus slide previews. Subdomains confirmed, DNS in Route 53. Decks are `.ppt`/`.pptx` only. Purchase history is exportable, so ingest adds a purchase-history import. |
| v4 | Cognito + Amplify Gen 2 approved. Aeonik licensed. Purchase-history import deferred to Should-have. No asset has been used on a project yet. All MVP decisions resolved. |
| v5 | Clarified as a personal project: the owner bought and personally owns every asset. Audience wording updated to match. `example.com` is a placeholder for the owner's domain, set per deployment. Sign-in is still limited to one Google Workspace domain. No design changes. |

## Summary

Content Forge is a private web catalog for the owner's personally purchased digital assets: website templates, PowerPoint templates, video, images, textures, and other assets bought from marketplaces such as ThemeForest. Signed-in users browse the catalog in a row-per-category layout (like a streaming service), open a detail page for any item, download it, and view a live demo for website templates. The front end is a static Next.js export hosted on AWS Amplify. Amplify Gen 2 backend resources (Cognito, AppSync/DynamoDB, S3, Lambda) live in TypeScript in the repo. There is no NAT Gateway and no always-on compute, and the target cost is near $0/month beyond S3 storage.

---

## Background

- **Problem**: The paid assets are scattered across marketplace accounts and local drives. There's no single view of what the owner already has, so assets get bought twice or go unused, and there's no record of which projects used which asset.
- **Goal**: One private place to find, preview, and download every licensed asset, and later to track where each one has been used.
- **Audience**: The owner, who bought and personally owns every asset in the library. The design also allows a few invited users on the owner's Google Workspace domain. Users are technical, and they'll often be hunting for a starting point for a new project.
- **Catalog size**: Hundreds of items today.
- **Success criteria (MVP)**:
  1. A signed-in user can browse every item in the catalog, grouped by category.
  2. A user can open an item's detail page and download the original asset.
  3. A user can open a live demo for website templates that can run as static files.
  4. Only `@example.com` Google Workspace accounts can see any catalog data.
  5. The whole existing library (hundreds of items) can be ingested in batch, with thumbnails and previews generated automatically.
  6. Monthly AWS cost is roughly S3 storage plus a few dollars at most.

---

## Scope (MoSCoW)

| Must (MVP) | Should | Could | Won't (this release) |
|---|---|---|---|
| Google Workspace SSO via Cognito | "See all" grid per content type | Favorites / recently viewed rows | Search & tag filtering |
| Public landing page | Download count on detail page | Multiple demo variants per item | Admin UI (CLI only for MVP) |
| Browse page with category rows | Vendor demo link fallback | Mobile layout polish | Roles/permissions beyond "user" |
| Content detail page | Video preview playback | | Usage tracking vs. projects (phase 2, Aurora) |
| Download (logged) | PowerPoint slide gallery | | Analytics dashboard |
| Live demo for static website templates | | | |
| Batch ingest CLI with preview generation | | | |
| Amplify Gen 2 backend + Hosting | | | |

---

## Functional Requirements

### FR-1: Google Workspace SSO (Cognito)
**Priority**: Must-have
**Description**: Users sign in with their `@example.com` Google Workspace account. Sign-in goes through an Amazon Cognito user pool with Google as a federated identity provider, configured with Amplify Gen 2 `defineAuth`.
**Acceptance Criteria**:
- [ ] The landing page has a "Sign in with Google" action. It calls Amplify `signInWithRedirect({ provider: 'Google' })`.
- [ ] The Google Cloud OAuth client is set to **Internal** (Workspace-only) and passes `hd=example.com`.
- [ ] A Cognito **Pre sign-up** Lambda trigger rejects any federated user whose verified email isn't `@example.com`. This is the authoritative check. The OAuth settings above are defense in depth.
- [ ] Rejected users go back to `/` with a clear "authorized accounts only" message.
- [ ] App routes other than `/` and `/auth/callback` render only once a session exists. Otherwise they redirect to `/` on the client.
- [ ] **All real protection is on the backend**: AppSync, Lambda, and CloudFront each require a valid Cognito token or signed cookie. Static HTML/JS bundles contain no catalog data.
- [ ] Sign-out clears the Amplify session and the asset cookies (FR-6).
- [ ] Sessions persist across browser restarts using Cognito refresh tokens (default 7 days, configurable).

### FR-2: Pre-Login Home Page (`/`)
**Priority**: Must-have
**Acceptance Criteria**:
- [ ] Shows Content Forge branding (see Branding), a one-line description of Content Forge, and the sign-in button.
- [ ] Shows **no** catalog content, thumbnails, or metadata.
- [ ] A user who already has a session is redirected to `/browse`.
- [ ] Sign-in errors (wrong domain, cancelled consent) appear here.

### FR-3: Post-Login Home / Browse Page (`/browse`)
**Priority**: Must-have
**Description**: Category rows that scroll horizontally, one row per content type.
**Acceptance Criteria**:
- [ ] One row per content type that has at least one published item, in a fixed configured order: Website Templates, PowerPoint Templates, Video, Images, Textures, Other.
- [ ] Each card shows a generated thumbnail, title, and content-type badge.
- [ ] Rows scroll by mouse/trackpad, by labeled previous/next controls, and by keyboard (arrow keys within a row, Tab between rows).
- [ ] A type nav (header or row titles) lets the user jump to a content type.
- [ ] Activating a card opens the item's detail page.
- [ ] Loading state: skeleton rows/cards while data loads on the client. No layout shift when thumbnails arrive.
- [ ] Empty state if the catalog has no published items.
- [ ] The header shows the signed-in user's name/avatar and sign-out.
- [ ] Each row loads its first page (e.g., 20 items) with one query on a type index. More items load as the user scrolls.
- [ ] *(Should)* Each row has a "See all" link to `/browse/[type]`, a grid of every item of that type. The types are a fixed set, so these pages are pre-rendered with `generateStaticParams`.

### FR-4: Content Detail Page (`/content?slug=<slug>`)
**Priority**: Must-have
**Description**: Everything about one asset and the actions available for it. It's a single static page that loads the item on the client by the `slug` query parameter (see D-5).
**Acceptance Criteria**:
- [ ] Shows the title, content type, description, tags, source marketplace (linked to the original listing), license type, original filename, download size, and type-specific metadata (e.g., video duration/resolution, slide count, image dimensions).
- [ ] Shows the type-specific preview (FR-7).
- [ ] Has a **Download** button (FR-5).
- [ ] Has a **Live Demo** button when the item has a hosted demo (FR-6). *(Should)* Otherwise shows "Vendor demo" when an `externalDemoUrl` is recorded.
- [ ] An unknown or missing slug shows a not-found state with a link back to `/browse`.
- [ ] *(Should)* Shows the download count.
- [ ] *(Phase 2)* Lists the projects that used the asset.

### FR-5: Download
**Priority**: Must-have
**Description**: Download the original asset exactly as purchased (usually a `.zip`; PowerPoint templates are always zips).
**Acceptance Criteria**:
- [ ] The Download button calls an Amplify Data custom query, `getDownloadUrl(contentId)`, which runs a Lambda function. The Lambda:
  - reads the caller's identity from the Cognito-authorized AppSync request;
  - writes a `DownloadEvent` and atomically increments `downloadCount`;
  - returns a **CloudFront signed URL** for `assets.example.com/a/<contentId>/<file>` that expires in 5 minutes.
- [ ] Downloads use `Content-Disposition: attachment` with the original filename (set as object metadata at ingest).
- [ ] Multi-GB files download directly from CloudFront. No app compute is in the data path.
- [ ] If the object is missing or the Lambda fails, the user sees an error toast, not a broken download.

### FR-6: Live Demo & Authenticated Asset Access
**Priority**: Must-have (website templates)
**Description**: Unzipped website templates and all thumbnails/previews are served from a private CloudFront distribution at `assets.example.com`. Access requires CloudFront **signed cookies**.
**Acceptance Criteria**:
- [ ] After sign-in, the app calls `POST https://assets.example.com/_session` with the Cognito ID token, using `credentials: 'include'`. This endpoint is a Lambda function URL behind the assets distribution. The Lambda:
  - verifies the token (issuer, audience, expiry, `@example.com` email);
  - sets CloudFront signed cookies scoped to `https://assets.example.com/v/*`, valid for 12 hours;
  - restricts CORS to `https://content.example.com`.
- [ ] The app refreshes the cookies before they expire, and again after any `403` from the assets domain.
- [ ] The Live Demo button opens `https://assets.example.com/v/<contentId>/demo/<demoEntryPath>` in a new tab.
- [ ] Relative CSS/JS/image paths inside templates resolve correctly.
- [ ] Demo JavaScript runs on `assets.`, a **different origin** from the app (`content.`). The app's Cognito tokens live in the app origin's storage, so demo code can't read them. The app never sets cookies on `.example.com`.
- [ ] Archives (`/a/*`) are **not** covered by the cookie. They require a per-file signed URL (FR-5).
- [ ] Items that can't run as static files (WordPress themes, templates that need a build step) have no hosted demo. *(Should)* They fall back to `externalDemoUrl`.

### FR-7: Type-Specific Previews
**Priority**: Must-have (thumbnails), Should-have (rich previews)

| Type | Card thumbnail | Detail-page preview | Live demo |
|---|---|---|---|
| Website template | Screenshot of demo entry page | Desktop (1440×900) + mobile (390×844) screenshots | Yes (FR-6) |
| PowerPoint template | First slide | Gallery of the first ≤12 slides | No |
| Video | Poster frame | `<video>` player streaming a ≤30s 720p preview (range requests) | No |
| Image | Downscaled image | Large preview, zoomable | No |
| Texture | Downscaled image | Tiled preview (CSS `background-repeat`) at 2–3 scales | No |
| Other | Type icon (or supplied image) | Description + archive file listing | No |

- [ ] All previews are generated at ingest (FR-9) as fixed sizes (`thumb-320.webp`, `thumb-640.webp`, `preview-<n>.webp`). There is no runtime image optimization. `next/image` uses a custom loader that maps to these keys, or plain `<img>` is used.
- [ ] Every image has `alt` text (defaults to the item title + "preview").

### FR-8: Download Event Logging
**Priority**: Must-have (log), Should-have (display)
- [ ] Each download records `contentId`, `userEmail`, and `downloadedAt`. Only the download Lambda writes these.
- [ ] A failed log write is reported to CloudWatch. It does not block the download.

### FR-9: Batch Ingest CLI with Preview Generation
**Priority**: Must-have
**Description**: A local Node/TypeScript CLI loads the existing library (hundreds of items) and new purchases. It generates previews on the owner's machine, so ingest costs no AWS compute.
**Acceptance Criteria**:
- [ ] **Batch mode**: `npm run ingest -- --dir <folder> [--manifest manifest.csv] [--concurrency 4]` processes every archive or file in a folder. **Single mode**: `npm run ingest -- <file> [flags]`.
- [ ] **Metadata**: comes from an optional CSV/JSON manifest or per-item `content.json` sidecar (title, type, description, tags, sourceMarketplace, sourceUrl, externalDemoUrl, licenseType, purchaseDate). Missing fields fall back to defaults. The title defaults to a cleaned-up filename.
- [ ] *(Should, deferred until sample exports are available; see Q-G)* **Purchase-history import**: `npm run ingest -- import-purchases <export.csv> --marketplace <name>` turns a marketplace purchase-history export into manifest rows (title, sourceUrl, licenseType, purchaseDate). It matches rows to archives by item name/filename, and writes unmatched rows and unmatched archives to a report for manual mapping.
- [ ] **Type auto-detection**, overridable per item:
  - extracted tree has an HTML entry point → `website-template`;
  - `.ppt`/`.pptx` present → `powerpoint-template`;
  - video extension → `video`;
  - image extension → `image`;
  - `texture` only when flagged, or when the source folder is named so;
  - anything else → `other`.
- [ ] **Archive handling**:
  - extracts to a temp dir;
  - recurses into nested zips (common in marketplace packages, e.g., a "main files" zip inside the download);
  - rejects path-traversal/absolute entries;
  - enforces a max extracted size (zip-bomb guard).
- [ ] **Website templates**: picks the demo entry (the shallowest `index.html`, preferring folders named like `demo`, `html`, `dist`, `template`), overridable with `demoEntryPath`. Uploads the extracted demo folder to `v/<id>/demo/`. Serves it locally and screenshots it with Playwright (Chromium) at desktop and mobile sizes.
- [ ] **PowerPoint**: extracts the zip and finds the primary deck (largest `.ppt`/`.pptx`, overridable). Converts it to PDF with LibreOffice headless, then renders slides to images. **Only the original zip and the previews are stored**; the extracted deck isn't uploaded.
- [ ] **Video**: `ffprobe` metadata (duration, resolution, codec). `ffmpeg` poster frame (~10% in) and a ≤30s 720p H.264 `faststart` preview clip.
- [ ] **Images/textures**: `sharp` resizes to WebP sizes and records dimensions.
- [ ] **Uploads**: the original goes to `a/<id>/<originalFilename>` with `Content-Disposition` metadata. Previews go to `v/<id>/…`. Then the `Content` record is written.
- [ ] **Idempotent and resumable**: re-running for the same slug updates the record and replaces previews. A local state file skips items already done. Failures go to `ingest-report.json` and don't stop the batch.
- [ ] **Dry run**: `--dry-run` prints the detected type, entry point, and metadata without uploading.
- [ ] **Prerequisites are documented** and checked at startup: Node, ffmpeg/ffprobe, LibreOffice, Playwright Chromium, poppler (`pdftoppm`) or an equivalent.
- [ ] The CLI uses the owner's AWS credentials (profile). Bucket/table names come from `amplify_outputs.json` custom outputs.

### FR-10: Usage Tracking Against Projects
**Priority**: Won't (MVP) — Phase 2
- [ ] CRUD for clients and projects. Link content items to projects with notes and an optional live URL.
- [ ] The detail page lists the projects that used the item. A report shows assets in use per license type.
- [ ] Stored in Aurora Serverless v2 (MySQL-compatible), accessed **only through the RDS Data API** from Lambda, so no VPC-attached Lambda and no NAT Gateway (see D-4).

---

## Non-Functional Requirements

### NFR-1: Security
- S3 is private, with no public access. CloudFront reaches it through **Origin Access Control**.
- Every catalog read requires Cognito auth: AppSync `allow.authenticated()` for reads, and writes only by the ingest identity (IAM) and the download Lambda.
- Asset access uses signed cookies (view prefix, 12 hours) and signed URLs (archives, 5 minutes).
- The CloudFront key-pair private key is stored as an SSM Parameter Store SecureString (standard tier, free) or an Amplify secret. It's never committed.
- The Google OAuth client secret is set with `npx ampx sandbox secret` / Amplify secrets.
- The app origin (`content.`) sends a strict CSP (via Amplify Hosting custom headers), and the asset session endpoint uses a CORS allow-list.
- Least-privilege IAM for each Lambda.
- The ingest zip guards are listed in FR-9.

### NFR-2: Performance
- Browse page: first catalog rows visible in < 2.5s on broadband. The app shell is served from Amplify's CDN.
- Thumbnails come from CloudFront with long-lived cache headers. Keys are content-addressed or versioned so they can be immutable.
- Catalog queries use indexes (`byType`, `bySlug`), never scans.
- `getDownloadUrl` p95 < 500ms (warm).

### NFR-3: Accessibility
- WCAG 2.1 AA.
- Interactive UI is built with **React Aria Components**, with `RouterProvider` wired to Next's `useRouter` so React Aria links use client-side navigation.
- Rows can be navigated by keyboard and focus is visible. Scroll buttons are labeled. `prefers-reduced-motion` is respected.
- Brand magenta `#B82471` on `#111` is about 3.2:1. Use it only for large text, icons, or non-text accents. Use amber `#F2A524` (about 9:1 on `#111`) or `#E5E5E5` for body text and interactive labels.

### NFR-4: Maintainability (agentic development)
- TypeScript strict mode, and ESLint runs on the Amplify build.
- Clear boundaries so Claude agents can work on isolated slices: `src/app` (routes), `src/components`, `src/lib/{auth,data,assets}`, `amplify/` (backend), `tools/ingest/` (CLI).
- `AGENTS.md` documents commands, the static-export constraints (no route handlers, no `proxy.ts`, no server actions, no default image optimizer), and Amplify sandbox usage.
- Each feature lands with tests (see Testing).

### NFR-5: Cost
| Component | Expected cost at personal scale |
|---|---|
| Amplify Hosting (static) | Cents/month (build minutes + small transfer) |
| Cognito (Lite/Essentials, < 50 users) | $0 (within free MAU) |
| AppSync + DynamoDB on-demand | Cents/month |
| Lambda (download, session, pre sign-up) | $0 (always-free tier) |
| CloudFront (assets) | $0 up to the always-free monthly transfer allowance |
| S3 storage | **Main cost**: ~$0.023/GB-month Standard, lower with Intelligent-Tiering |
| NAT Gateway / VPC | **None** |

- AWS Budget alert at $5/month (adjustable), defined in the Amplify backend's custom CDK stack.
- CloudWatch log retention set to 14 days.
- *Verify free-tier figures against current AWS pricing before launch.*

### NFR-6: Browser Support
- Latest two versions of Chrome, Edge, Firefox, Safari. Desktop first. Usable at tablet width.

---

## User Stories
- **US-1**: As a user, I want to sign in with my Google Workspace account so that I don't need a separate password.
- **US-2**: As a user, I want to see all the assets grouped by type so that I can quickly scan what's in the library.
- **US-3**: As a user, I want to open an asset's details and previews so that I can judge whether it fits my project.
- **US-4**: As a user, I want to try a website template's live demo so that I can evaluate it without downloading it and running it locally.
- **US-5**: As a user, I want to download an asset in one click so that I can start using it right away.
- **US-6**: As the owner, I want to ingest my whole existing library in one batch run, with previews generated for me, so that the catalog is useful from day one.
- **US-7** *(phase 2)*: As the owner, I want to see which projects used an asset so that I can stay license-compliant and show examples.
- **US-8**: As someone without an allowed account, I must be unable to view or download any asset.

---

## Technical Specifications

### Stack
| Concern | Choice |
|---|---|
| Framework | Next.js 16.4 **static export** (`output: 'export'`), App Router, React 19.3, React Compiler |
| Styling | Tailwind CSS v4 with brand tokens (see Branding) |
| Components | React Aria Components |
| Routing | Next.js App Router (client-side navigation) |
| Hosting | AWS Amplify Hosting (static), `us-west-2` |
| Backend | **Amplify Gen 2** (`amplify/` TypeScript, built on CDK; custom resources via `backend.createStack()`) |
| Auth | Cognito user pool + Google federation (`defineAuth`), Pre sign-up domain trigger |
| Data | Amplify Data (AppSync + DynamoDB) |
| Storage | One S3 bucket (`defineStorage`) + custom CloudFront distribution for `assets.example.com` |
| Functions | `defineFunction`: `getDownloadUrl`, `assetSession`, `preSignUp` |
| Ingest | Node/TS CLI in `tools/ingest/` using sharp, ffmpeg, LibreOffice, Playwright, AWS SDK v3 |
| Testing | Vitest + React Testing Library, Playwright, axe-core, CDK assertions on custom stacks |

### Static-Export Constraints (Next.js 16)
`output: 'export'` rules out route handlers that read the request, `proxy.ts`, server actions, cookies, rewrites/redirects/headers in `next.config`, ISR, the default image loader, and dynamic routes without `generateStaticParams`. So:
- All data fetching happens on the client with the Amplify Data client.
- Auth gating in the app is a client-side guard in the `(app)` route-group layout. The backend enforces the real authorization.
- Response headers (CSP, caching) and SPA fallbacks are set in Amplify Hosting custom headers/rewrites.
- Detail pages use a query parameter (D-5).

### Routes
```
content.example.com
  /                       Public landing
  /auth/callback          Completes Cognito redirect sign-in → /browse
  /browse                 Category rows (post-login home)
  /browse/[type]          See-all grid (generateStaticParams over fixed types)   (Should)
  /content?slug=<slug>    Content detail (client-loaded)

assets.example.com   (CloudFront → S3 via OAC; trusted key group on /v/* and /a/*)
  /_session               Lambda function URL: Cognito token → signed cookies for /v/*
  /v/<id>/thumb-320.webp, /v/<id>/preview-<n>.webp, /v/<id>/preview.mp4
  /v/<id>/demo/...        Unzipped website template
  /a/<id>/<file>          Original archive (per-file signed URL only)
```

### Data Models (Amplify Data)
**`Content`**: auth: authenticated read; write by ingest IAM role only
| Field | Type | Notes |
|---|---|---|
| id | ID | Generated |
| slug | String! | Unique. Secondary index `bySlug` |
| type | Enum! | `WEBSITE_TEMPLATE`, `POWERPOINT_TEMPLATE`, `VIDEO`, `IMAGE`, `TEXTURE`, `OTHER`. Index `byType` sorted by `publishedAt` |
| status | Enum! | `DRAFT`, `PUBLISHED` |
| title, description | String | |
| tags | [String] | |
| sourceMarketplace, sourceUrl, externalDemoUrl | String | |
| licenseType | Enum | `REGULAR`, `EXTENDED`, `OTHER`, `UNKNOWN` |
| purchaseDate, publishedAt | Date / DateTime | |
| archiveKey, archiveFileName | String! | `a/<id>/<file>` |
| archiveBytes | Int | |
| demoEntryPath | String | Relative to `v/<id>/demo/`; null = no hosted demo |
| thumbKey, previewKeys, videoPreviewKey | String / [String] | |
| meta | JSON | duration, resolution, slideCount, dimensions, fileList |
| downloadCount | Int | Atomic increment by download Lambda |

**`DownloadEvent`**: auth: write by `getDownloadUrl` function only; read by authenticated users
| Field | Type |
|---|---|
| contentId | ID! (index `byContent` sorted by `downloadedAt`) |
| userEmail | String! |
| downloadedAt | DateTime! |

**Custom query** `getDownloadUrl(contentId: ID!): { url: String!, expiresAt: AWSDateTime! }`, backed by a Lambda function.

### Aurora Schema (phase 2)
```sql
CREATE TABLE clients (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id CHAR(36) PRIMARY KEY,
  client_id CHAR(36) NOT NULL REFERENCES clients(id),
  name VARCHAR(255) NOT NULL,
  live_url VARCHAR(2048),
  started_at DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_usage (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL REFERENCES projects(id),
  content_id VARCHAR(64) NOT NULL,          -- Amplify Data Content.id
  used_by_email VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content (content_id)
);
```

### Repository Layout
```
amplify/
  auth/resource.ts            defineAuth (Google), preSignUp trigger
  data/resource.ts            Content, DownloadEvent, getDownloadUrl
  storage/resource.ts         content bucket
  functions/{get-download-url,asset-session,pre-sign-up}/
  backend.ts                  custom CDK stack: assets CloudFront, key group, budget, outputs
src/app/                      landing, (app)/browse, (app)/content, auth/callback
src/components/               CategoryRow, ContentCard, previews/*, AppHeader
src/lib/{auth,data,assets}/
tools/ingest/                 batch ingest CLI
```

---

## Branding
Supplied by the owner (the logo and final assets are still to come):

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#111111` | Page background (dark theme) |
| `--color-surface` | `#303030` / `#222222` | Cards, header, panels |
| `--color-text` | `#E5E5E5` | Body text |
| `--color-muted` | `#999999` / `#AAAAAA` | Secondary text |
| `--color-primary` | `#F2A524` (amber) | Primary actions, focus rings, links |
| `--color-secondary` | `#B82471` (magenta) | Accents, badges (large text/non-text only) |
| `--color-accent` | `#AFFC41` (lime) | Sparing highlights |
| Heading font | Aeonik | Commercial typeface. The existing license covers this app |
| Body font | Lato | |
| Logo | `Logo_White_Text.svg` | White wordmark for dark backgrounds |

Voice: direct, practical, no fluff, matching the site's tagline "We fix the systems bottlenecks behind broken workflows, one at a time."

---

## Key Decisions

| ID | Decision | Status |
|---|---|---|
| D-1 | Routing: Next.js App Router, no React Router | ✅ Resolved |
| D-2 | Auth: **Cognito + Google federation via Amplify Auth**. *Revised:* Auth.js was agreed, but it needs a server runtime, and that isn't available in a static export. | ✅ Resolved |
| D-3 | DynamoDB only for the MVP; Aurora in phase 2 | ✅ Resolved |
| D-4 | **Amplify Gen 2** (TypeScript backend in-repo, built on CDK, deployed by `ampx`/Amplify CI), not Gen 1 (`amplify` CLI, legacy). No NAT Gateway in either case: Lambdas stay outside a VPC, and phase-2 Aurora uses the Data API. Custom pieces (assets CloudFront, budget) use plain CDK inside `backend.ts`. | ✅ Resolved |
| D-5 | Detail route is `/content?slug=…`, not `/content/[slug]`. Static export needs every dynamic path known at build time, which would mean a full rebuild after every ingest. | Recommended |

---

## Dependencies
- Google Workspace admin: an **Internal** OAuth client. Redirect URI = Cognito domain `/oauth2/idpresponse`.
- Route 53 hosted zone for `example.com`, used for `content.` (Amplify custom domain; Amplify manages its certificate) and `assets.` (CloudFront alias record). The ACM certificate for `assets.` must be in **us-east-1** (CloudFront requirement), even though the stack is in us-west-2. DNS validation through Route 53 is automatic.
- An AWS account with Amplify connected to the GitHub repo `bobthemagicman/content-forge`.
- CloudFront public key + trusted key group for signed URLs/cookies.
- Local ingest machine with ffmpeg, LibreOffice, poppler, and Playwright Chromium.
- npm: `aws-amplify`, `@aws-amplify/backend`, `@aws-amplify/backend-cli`, `react-aria-components`, `aws-jwt-verify`, `@aws-sdk/cloudfront-signer`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `sharp`, `playwright`, `yauzl` (or `unzipper`), `fast-csv`.

## Assumptions
- Hundreds of items, tens to low hundreds of GB total.
- Everyone signed in can see and download everything. No per-item permissions.
- The owner is the only ingester for the MVP.
- Website templates that ship only as source (needing a build) or as WordPress/PHP themes get no hosted demo.
- One production environment (`master` branch). Amplify sandboxes are for development.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| **Marketplace license terms** (e.g., Envato Regular vs. Extended) may not allow sharing with other users | High | No asset has been used on a project yet, so phase-2 usage tracking starts clean with no backfill. Record license type per item and show it on the detail page. Review terms before giving anyone else access. |
| Third-party template JS runs in users' browsers | High | Separate `assets.` origin, no shared cookies, tokens only in app-origin storage, signed-cookie scope limited to `/v/*`. |
| Ingest heuristics guess wrong (nested zips, wrong demo entry, wrong deck) across hundreds of items | Medium | `--dry-run`, per-item overrides, ingest report, idempotent re-runs. |
| LibreOffice renders PowerPoint slides imperfectly (missing fonts) | Medium | Install fonts bundled in the template before converting. Accept preview-grade fidelity. Allow manual preview override. |
| Next.js 16 static export / Amplify Hosting quirks (trailing slashes, 404s) | Low–Med | Phase 0 deploy spike. Set `trailingSlash` and Amplify rewrites. |
| Cross-region ACM cert for the assets distribution from a us-west-2 Amplify stack | Low | Create the us-east-1 cert once (Route 53 DNS validation) and import it by ARN, or deploy a small us-east-1 certificate stack with cross-region references. |
| Signed-cookie expiry mid-session breaks images/demos | Low | Proactive refresh plus retry on 403. |
| S3 storage growth (video) | Medium | Intelligent-Tiering, unzipped copies only for website templates, budget alert. |

## Testing Requirements
- **Unit (Vitest)**: pre sign-up domain check; asset-session token verification + cookie policy; download URL signing + event write; ingest type detection, entry-point selection, zip sanitization.
- **Component (RTL)**: `ContentCard`, `CategoryRow` keyboard behavior, detail-page actions by type (demo button presence, vendor fallback), not-found state.
- **E2E (Playwright)**: unauthenticated user stays on `/`; authenticated browse → detail → download returns a signed URL; demo loads with cookies; wrong-domain user is rejected. Uses a test Workspace account, or a stubbed Amplify auth in a dedicated sandbox.
- **Accessibility**: axe on `/`, `/browse`, `/content` in CI.
- **Infra**: CDK assertions on the custom stack: bucket blocks public access, OAC used, trusted key groups on `/v/*` and `/a/*`, budget exists, no VPC/NAT resources.
- **Ingest fixtures**: a small sample of each content type (including a nested-zip template and a zipped `.pptx`) run in CI with `--dry-run`.

## Implementation Plan & Rough Estimate (solo + agentic dev)
| Phase | Scope | Estimate |
|---|---|---|
| 0 | Static export config, Amplify Gen 2 backend skeleton, Amplify Hosting on `content.example.com` | 1–2 days |
| 1 | Cognito + Google, pre sign-up trigger, landing page, client auth guard, brand tokens | 1–2 days |
| 2 | Data models, storage bucket, assets CloudFront + signed cookies/URLs, `assetSession` + `getDownloadUrl` | 2–3 days |
| 3 | Ingest CLI: extraction, type detection, previews for all types, batch/resume/report | 4–6 days |
| 4 | Browse page with React Aria rows | 2–3 days |
| 5 | Detail page, previews, download, live demo | 2–3 days |
| 6 | Ingest the real library, fix heuristics | 1–2 days |
| 7 | Tests, a11y pass, budget, docs | 1–2 days |
| **MVP total** | | **~14–23 days** |
| Phase 2 | Aurora (Data API) + project/usage tracking, admin UI, search | TBD |

---

## Open Questions
None blocking the MVP.

### Deferred
- **Q-G**: Which marketplaces will the purchase-history exports come from? A sample export (a few rows) is needed to build the column mapping for `import-purchases`. Deferred by the owner. Until then, ingest uses the manifest/sidecar and filename defaults, with `licenseType = UNKNOWN`.

### Resolved
- **Q-C**: Cognito + Google (D-2) and Amplify Gen 2 (D-4) approved. ✅
- **Q-F**: Aeonik is licensed for this use, so it's the heading font. ✅
- **Q-A**: PowerPoints: store only the original zip + generated slide previews. ✅
- **Q-B**: Subdomains `content.` / `assets.example.com` confirmed. DNS is in Route 53. ✅
- **Q-D**: Decks are `.ppt`/`.pptx` only (no Keynote). ✅
- **Q-E**: Purchase metadata is exportable → `import-purchases` step added to FR-9. ✅
