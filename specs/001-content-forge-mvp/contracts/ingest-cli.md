# Contract: Ingest CLI (`tools/ingest`)

**User**: the catalog owner, on their own machine with AWS credentials · **Implements**: US4,
FR-030–FR-040 · **Design**: research R5 and R14, [data-model.md](../data-model.md)

## Invocation

```text
npm run ingest -- <command> [options]

Commands
  batch <dir>            Import every archive/file directly inside <dir> (non-recursive at top level;
                         each top-level entry is one item; a folder counts as one item)
  one <path>             Import a single archive/file
  doctor                 Check required tools and AWS access, then exit

Common options
  --profile <name>       AWS profile (default: $AWS_PROFILE)
  --outputs <file>       Path to amplify_outputs.json (default: ./amplify_outputs.json)
  --manifest <file>      CSV or JSON manifest of per-item details (see below)
  --dry-run              Detect and report only; no uploads, no DB writes
  --draft                Write items as DRAFT (default: PUBLISHED)
  --concurrency <n>      Parallel items (default 4, max 8)
  --force                Reprocess even if the source hash is unchanged
  --report <file>        Report path (default: ./ingest-report.json)
  --state <file>         Resume-state path (default: ./.ingest-state.json)

Per-item overrides (with `one`, or through manifest/sidecar)
  --type <TYPE>  --slug <slug>  --title <text>  --demo-entry <relpath>  --deck <relpath>
```

`import-purchases` is **deferred** (spec Out of Scope, Q-G) and isn't part of this contract.

## Item details sources (later sources win)

1. **Defaults**: `title` from the file name (extension removed, separators turned into spaces, title
   case). `slug` = kebab-case of `title`. `licenseType = UNKNOWN`. `type` = auto-detected.
2. **Manifest** (`--manifest`), matched on `source` = the file or folder name relative to `<dir>`.
3. **Sidecar** `<source>.content.json` next to the item, or `content.json` inside a folder item.
4. **CLI flags** (with `one` only).

### Manifest / sidecar fields

| Field | Type | Notes |
|---|---|---|
| `source` | string | Manifest only. Key for matching |
| `slug` | string | `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `title` | string | |
| `type` | `WEBSITE_TEMPLATE` \| `POWERPOINT_TEMPLATE` \| `VIDEO` \| `IMAGE` \| `TEXTURE` \| `OTHER` | Overrides detection |
| `description` | string | |
| `tags` | string (CSV: `;`-separated) / string[] (JSON) | |
| `sourceMarketplace`, `sourceUrl`, `externalDemoUrl` | string | URLs must be `https://` |
| `licenseType` | `REGULAR` \| `EXTENDED` \| `OTHER` \| `UNKNOWN` | |
| `purchaseDate` | `YYYY-MM-DD` | |
| `demoEntry` | string | Relative path inside the extracted package |
| `deck` | string | Relative path of the primary `.ppt`/`.pptx` |
| `status` | `DRAFT` \| `PUBLISHED` | |

Invalid values mark that item `failed` with a validation message. The batch continues.

## Detection rules (first match wins, unless overridden)

1. The package contains an `.html` entry → `WEBSITE_TEMPLATE`. Entry choice: the shallowest
   `index.html`, preferring path segments named `demo`, `html`, `dist`, `template`, `preview`. If
   there's no `index.html`, the shallowest `*.html`.
2. It contains `.ppt`/`.pptx` → `POWERPOINT_TEMPLATE`. Deck choice: the largest file.
3. The item is, or mainly contains, a video (`.mp4 .mov .m4v .webm .mkv`) → `VIDEO`.
4. The item is, or mainly contains, an image (`.jpg .jpeg .png .webp .tif .tiff`) → `IMAGE`, or
   `TEXTURE` if a path segment matches `/textures?/i` or `type: TEXTURE` is given.
5. Otherwise → `OTHER`.

Website templates whose package has a `package.json` with build scripts and no prebuilt HTML, or
that look like WordPress themes (`style.css` with a `Theme Name:` header), get **no hosted demo**
(`demoEntryPath` absent) and a warning in the report.

## Safety limits (FR-032)

The archive is rejected (item `failed`) when any entry has an absolute path, a drive letter, or a
`..` segment after normalizing; when the total uncompressed size is over 10 GiB; when it has over
200,000 entries; or when nesting goes deeper than 3 levels.

## Per-item pipeline

`hash source` → `skip if unchanged (state)` → `extract (temp dir)` → `detect` → `generate previews` →
`look up existing by slug` → `upload a/ (multipart, Content-Disposition)` → `upload v/` →
`write Content` → `record state` → `clean temp`

On re-import of an existing slug, the item keeps its `id`, `downloadCount` and `publishedAt`. New
preview keys replace the old ones, and old `v/` objects are deleted after the record is written.

## Output

- **Console**: one progress line per item, then totals (`processed / succeeded / failed / skipped`).
- **Report** (`ingest-report.json`): shape in [data-model.md](../data-model.md#entity-import-report-local-file).
- **Exit codes**:

  | Code | Meaning |
  |---|---|
  | `0` | All items succeeded or were skipped |
  | `1` | At least one item failed |
  | `2` | Bad usage or config (missing outputs file, invalid flags) |
  | `3` | `doctor` or startup check failed (missing tool or AWS access) |

## `doctor` / startup checks (FR-039)

Checks for `ffmpeg`, `ffprobe`, `soffice`, `pdftoppm`, Playwright Chromium, a readable
`amplify_outputs.json` with the `custom.*` keys, and AWS identity
(`sts:GetCallerIdentity`) with access to the bucket and table. It prints each check as ✔/✖ with an
install hint (e.g., `brew install --cask libreoffice`, `brew install poppler`).
