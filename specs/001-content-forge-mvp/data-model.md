# Data Model: Content Forge MVP

**Feature**: `001-content-forge-mvp` | **Date**: 2026-10-27 | **Plan**: [plan.md](./plan.md)

Derived from the spec's Key Entities and research decisions R4, R5, R9 and R14. The data layer has
three stores:

| Store | Owner | Purpose |
|---|---|---|
| `Content` (Amplify Data model → DynamoDB table + AppSync) | `amplify/data/resource.ts` | The catalog. Users read it through the API. Ingest and the download function write it directly |
| `DownloadEvents` (plain DynamoDB table) | `AssetsCdn` construct | Append-only download log. Not exposed through the API |
| S3 bucket (`content-forge-assets-<env>`) | `AssetsCdn` construct | Original archives (`a/`) and viewable assets (`v/`) |

---

## Entity: Content

One purchased asset. Amplify-managed fields (`id`, `createdAt`, `updatedAt`, `__typename`) are set
by ingest when it writes directly (R5).

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | ID (UUID v4) | ✔ | Assigned on first import and **never changes** on re-import |
| `slug` | String | ✔ | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 80 chars, unique (enforced by ingest through a `bySlug` lookup before writing) |
| `title` | String | ✔ | 1–200 chars. Defaults to the cleaned-up file name |
| `type` | Enum `ContentType` | ✔ | See below |
| `status` | Enum `ContentStatus` | ✔ | `DRAFT` \| `PUBLISHED` |
| `publishedAt` | AWSDateTime | when `PUBLISHED` | **Absent (not null) when `DRAFT`**, which keeps drafts out of the sparse row index |
| `description` | String | | ≤ 5,000 chars, plain text |
| `tags` | [String] | | Each 1–40 chars, lower-case, de-duplicated, ≤ 20 tags |
| `sourceMarketplace` | String | | e.g. `ThemeForest`, `Envato Elements`, `Creative Market` |
| `sourceUrl` | AWSURL | | Link to the original listing |
| `externalDemoUrl` | AWSURL | | Vendor's own demo (FR-028) |
| `licenseType` | Enum `LicenseType` | ✔ | Defaults to `UNKNOWN` |
| `purchaseDate` | AWSDate | | |
| `archiveKey` | String | ✔ | `a/<id>/<archiveFileName>` |
| `archiveFileName` | String | ✔ | Original file name exactly as purchased |
| `archiveBytes` | Float (bytes) | ✔ | > 0. Float because GraphQL `Int` is 32-bit, which can't hold multi-GB sizes |
| `demoEntryPath` | String | | Only for `WEBSITE_TEMPLATE`. Relative path under `v/<id>/demo/`, no leading `/`, no `..`. Absent means no hosted demo |
| `accentColor` | String | | `^#[0-9A-F]{6}$`. Dominant color of the largest thumbnail, from `sharp().stats().dominant` at ingest, darkened (hue kept) to a relative luminance of at most 0.2 so text over its glow stays AA. Tints the detail page's glow; absent → the UI uses the type accent |
| `thumbKeys` | AWSJSON | ✔ | `{ "320": "v/<id>/thumb-320.<hash>.webp", "640": …, "1280": … }` |
| `previewKeys` | [String] | | Ordered gallery images (screenshots, slides, large image) |
| `videoPreviewKey` | String | | Only for `VIDEO`: `v/<id>/preview.<hash>.mp4` |
| `posterKey` | String | | Only for `VIDEO` |
| `meta` | AWSJSON | | Type-specific facts. Shape depends on `type` (see below) |
| `downloadCount` | Int | ✔ | Starts at 0. Changed only by atomic `ADD` in the download function |

**Indexes**

| Name | Partition key | Sort key | Used by |
|---|---|---|---|
| `bySlug` | `slug` | (none) | Detail page, ingest idempotency |
| `byTypeAndPublishedAt` (sparse) | `type` | `publishedAt` (desc in queries) | Browse rows, "See all" |

**Authorization**: `allow.authenticated().to(['read'])`. There are no API mutations. Writes come from
the owner's IAM identity (ingest) and the `get-download-url` function role (`downloadCount` only).

### Enum: ContentType

Values in row order, which is also the display order (FR-007):

| Value | Label | Hosted demo | Preview generation |
|---|---|---|---|
| `WEBSITE_TEMPLATE` | Website Templates | Yes, when runnable statically | Desktop + mobile screenshots |
| `POWERPOINT_TEMPLATE` | PowerPoint Templates | No | First slide = thumb. Up to 12 slides as gallery |
| `VIDEO` | Video | No | Poster + ≤30 s 720p clip |
| `IMAGE` | Images | No | Resized WebP sizes |
| `TEXTURE` | Textures | No | Resized WebP. The detail page tiles it |
| `OTHER` | Other | No | Type icon. File listing in `meta` |

### Enum: LicenseType

`REGULAR` | `EXTENDED` | `OTHER` | `UNKNOWN`

### `meta` shapes by type

| Type | Shape |
|---|---|
| `WEBSITE_TEMPLATE` | `{ "pageCount": number, "demoVariants"?: string[] }` |
| `POWERPOINT_TEMPLATE` | `{ "slideCount": number, "deckFileName": string, "aspectRatio": "16:9" \| "4:3" \| string }` |
| `VIDEO` | `{ "durationSec": number, "width": number, "height": number, "codec": string, "fps": number }` |
| `IMAGE` / `TEXTURE` | `{ "width": number, "height": number, "format": string }` |
| `OTHER` | `{ "fileList": { "path": string, "bytes": number }[] }`, capped at 500 entries |

### State transitions

```text
(none) ──ingest──▶ DRAFT ──ingest --publish (default)──▶ PUBLISHED
                     ▲                                       │
                     └──────────ingest --unpublish───────────┘   (removes publishedAt)
```

- By default ingest writes `PUBLISHED` with `publishedAt = now`, set on the first publish and
  kept on re-imports. `--draft` writes `DRAFT` without `publishedAt`.
- Re-import of an existing slug: updates the metadata and preview keys, keeps `id`, `downloadCount`
  and `publishedAt`, and sets `updatedAt`.
- Nothing is deleted in the MVP. Hiding an item means setting it to `DRAFT`.

---

## Entity: DownloadEvent (table `DownloadEvents`)

| Attribute | Type | Key | Rules |
|---|---|---|---|
| `contentId` | S | Partition | `Content.id` |
| `downloadedAtEmail` | S | Sort | `<ISO-8601 UTC>#<email>`, which keeps entries unique and in time order |
| `email` | S | | Lower-case. Domain must be `example.com` |
| `downloadedAt` | S | | ISO-8601 UTC |
| `archiveKey` | S | | Snapshot of the key served |

- Written only by `get-download-url`. Nothing reads it in the MVP (it's for the owner and phase 2).
- No TTL, kept indefinitely (small). On-demand billing, point-in-time recovery off (Principle I).

---

## Entity: User

Not stored by the app. Comes from the Cognito user pool, federated from Google.

| Claim | Use |
|---|---|
| `email` | Domain check (pre-sign-up, session Lambda, download function), download logging |
| `name`, `picture` | Header avatar/name (FR-014) |
| `sub` | Stable identifier, not used in the MVP |

Owner import rights come from IAM (AWS credentials), not from an app role.

---

## Entity: Import Report (local file)

`ingest-report.json`, written by the ingest CLI. It's never uploaded.

```text
{
  runId, startedAt, finishedAt, dryRun, totals: { processed, succeeded, failed, skipped },
  items: [{ source, slug, id?, detectedType, demoEntryPath?, status: "ok"|"failed"|"skipped",
            steps: string[], warnings: string[], error?: string }]
}
```

Companion `.ingest-state.json` (resume state): `{ [sourcePath]: { sha256, slug, id, completedSteps[] } }`.

---

## Storage layout (S3 bucket)

```text
a/<id>/<archiveFileName>                     original as purchased; Content-Disposition metadata set
v/<id>/thumb-{320,640,1280}.<hash>.webp      card + responsive thumbnails
v/<id>/preview-<n>.<hash>.webp               gallery (screenshots / slides / large image, 2048 px)
v/<id>/poster.<hash>.webp                    video poster
v/<id>/preview.<hash>.mp4                    video preview clip
v/<id>/demo/**                               unzipped website template (WEBSITE_TEMPLATE only)
```

`<hash>` is the item's import hash: 8 hex chars generated once per item per import run and shared by
all of that item's generated files, so keys differ only by name and width (research R14). Every
re-import gets new keys, and superseded keys are deleted after the record is written.

Every `v/` object except `demo/**` is keyed by import hash and gets `Cache-Control: public, max-age=31536000,
immutable`. `demo/**` gets `max-age=3600`. `a/` objects get `Cache-Control: private, no-store`.

---

## Validation summary (from requirements)

| Rule | Source | Enforced in |
|---|---|---|
| Only `@example.com` identities | FR-001/002 | Pre-sign-up trigger, session Lambda, download function |
| Download URL ≤ 5 min | FR-018 | Download function (canned policy expiry) |
| Archive paths safe, size-capped | FR-032 | Ingest extractor |
| Demo path has no traversal | FR-034 | Ingest (normalize + reject `..`) |
| Re-import doesn't duplicate | FR-037, SC-009 | Ingest `bySlug` lookup, stable `id` |
| Drafts not listed | FR-007 | Sparse index (`publishedAt` absent) + client check on detail page |
| Download logging never blocks | FR-020 | Download function (`Promise.allSettled`) |
