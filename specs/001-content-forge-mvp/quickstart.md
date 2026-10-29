# Quickstart & Validation Guide: Content Forge MVP

**Feature**: `001-content-forge-mvp` · **Plan**: [plan.md](./plan.md)

This guide covers how to set up, run, and **prove** the MVP works. Design details live in
[research.md](./research.md), [data-model.md](./data-model.md), and [contracts/](./contracts/).

---

## 1. Prerequisites

| Need | Check |
|---|---|
| Node.js 24 LTS | `node -v` → `v24.x` |
| AWS account, profile with admin rights for bootstrap | `aws sts get-caller-identity --profile <p>` |
| Route 53 hosted zone for your domain (`example.com` throughout these docs) | `aws route53 list-hosted-zones-by-name --dns-name example.com` |
| Google Workspace admin access | Can create an **Internal** OAuth client in Google Cloud Console |
| Ingest tools (owner machine) | `ffmpeg -version`, `soffice --version`, `pdftoppm -v`. Install the missing ones: `brew install --cask libreoffice` and `brew install poppler` |
| Playwright browsers | `npx playwright install chromium firefox webkit` |
| Licensed Aeonik WOFF2 files and the logo SVG | Placed in `src/app/fonts/` and `public/brand/` |

## 2. One-time bootstrap (documented exceptions to "everything as code")

1. **Edge certificate**: `cd infra/edge-cert && npm ci && npx cdk deploy --profile <p>`. Note the
   output `AssetsCertArn`.
2. **Signing keys**: `scripts/bootstrap/create-signing-keys.sh --env master --profile <p>`.
   - It writes the private key to SSM `/content-forge/master/cloudfront/private-key` (SecureString).
   - It writes the public key to `amplify/custom/assets-cdn/keys/master.public-key.pem`. Commit that
     file. Public keys aren't secret.
3. **Google OAuth client**: Internal; authorized redirect URI
   `https://<cognito-domain>/oauth2/idpresponse` (the Cognito domain appears after the first
   deploy; update it then).
4. **Amplify app**: connect the GitHub repo `bobthemagicman/content-forge` in `us-west-2`. Set:
   - secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`;
   - env vars `ASSETS_CERT_ARN`, `HOSTED_ZONE_ID`, and `BUDGET_ALERT_EMAIL` (where the $5 budget
     alert goes);
   - the custom domain `content.example.com` → branch `master`.

   Confirm the platform/framework setting from research R2.

## 3. Local development

```bash
npm ci
scripts/bootstrap/create-signing-keys.sh --env sandbox-$(whoami) --profile <p>   # once per sandbox
npx ampx sandbox --profile <p>        # personal cloud sandbox; writes amplify_outputs.json
npm run dev                           # http://localhost:3000
```

Sandboxes use their own bucket, table, Cognito pool, and signing keys. Commit the sandbox's
`keys/sandbox-<user>.public-key.pem`. The callback and logout URLs for `http://localhost:3000` are in
`defineAuth`.

Sandbox assets are served from the distribution's `*.cloudfront.net` domain with cross-site cookies,
and there's no budget or custom domain (research R19). **Use Chrome for local development.**
Browsers that block third-party cookies won't show sandbox previews or demos.

## 4. Load sample content

```bash
npm run ingest -- doctor
npm run ingest -- batch tests/fixtures/ingest --dry-run      # inspect detection only
npm run ingest -- batch tests/fixtures/ingest                # upload + write records
```

**Expected**: the report shows one item per fixture: a nested-zip website template, a zipped `.pptx`,
a short video, an image, and a texture. Detected types and demo entry are correct, `failed: 0`, and
the exit code is `0`.

## 5. Automated checks (CI gates, from the constitution)

```bash
npm run lint
npm run typecheck
npm test                     # Vitest: unit + component
npm run build                # static export to out/
npm run test:e2e             # Playwright vs out/ with mocked backend, includes axe checks
                             # (P1 journeys in Chromium, Firefox, and WebKit)
npm run test:infra           # CDK assertions (AssetsCdn, edge-cert) + log-retention guard
npm run test:ingest-e2e      # real ingest pipeline on fixtures, AWS mocked
                             # (needs ffmpeg, LibreOffice, poppler; CI job runs on ingest changes)
```

**Expected**: every command exits `0`, axe reports 0 violations, and the infra assertions confirm
there are no NAT/VPC resources, public access is blocked, and the budget exists in production mode
only.

## 6. End-to-end validation scenarios (deployed environment)

Run against `https://content.example.com` (or a sandbox URL) after step 4.

| # | Scenario | Steps | Expected | Proves |
|---|---|---|---|---|
| V1 | Landing hides content | Open `/` in a private window | Branding + "Sign in with Google". No thumbnails or item data in DOM or network | US1-1, FR-003 |
| V2 | Allowed sign-in | Sign in with an `@example.com` account | Arrive at `/browse/`. Header shows name/avatar | US1-2, FR-014 |
| V3 | Personal account rejected | Sign in with a personal Gmail | Back on `/` with "authorized accounts only" | US1-3, FR-001/002, SC-002 |
| V4 | Direct access denied | Signed out: `curl -I https://assets.example.com/v/<id>/thumb-320.<hash>.webp`, replay an expired download URL, and POST a `listContentByTypeAndPublishedAt` query to the AppSync URL with no token | `403` for the assets, `401` from AppSync | US1-6, FR-005, SC-002 |
| V5 | Rows | On `/browse/`, Tab into a row and use arrow keys and the next button | One row per non-empty type in the fixed order. Keyboard moves card to card | US2, FR-007–FR-011 |
| V6 | Detail + download | Open a card, then Download. Repeat with the largest archive in the library (multi-GB) | Detail facts shown. Download starts within 1 s and saves with its original name. The large file completes and its checksum matches the original. `downloadCount` +1 each time | US3, FR-015–FR-020, SC-001, SC-005 |
| V7 | Link expiry | Copy the signed URL from devtools and retry after 6 min | `403` | FR-018, SC-005 |
| V8 | Live demo | On the template, select Live Demo | Template renders with CSS/JS/images in a new tab on `assets.` | US5, FR-026 |
| V9 | Demo isolation | In the demo tab's console: `localStorage.length`, then `fetch('https://content.example.com/')` | No app tokens visible. Cross-origin read is blocked | FR-027 |
| V10 | Previews | Open the PPT, video, and texture items | Slide gallery (≤12), playable ≤30 s clip, tiled texture | US6, FR-024 |
| V11 | Re-import | Rerun step 4 without `--dry-run` | `skipped` for unchanged items. Same `id`s. No duplicates in rows | FR-037, SC-009 |
| V12 | Sign-out | Header → Sign out, then reload `/browse/` and an asset URL | Redirect to `/`. Asset returns `403` | FR-006 |
| V13 | Performance | Lighthouse (desktop defaults) on `/browse/`. Play a video preview | LCP < 2.5 s. Video starts within 2 s | SC-004, US6-2 |
| V14 | Cost guard | AWS Budgets console | `content-forge-monthly` budget at $5 with an alert | SC-008 |

## 7. Full library import (SC-003)

```bash
npm run ingest -- batch "<path-to-library>" --manifest library.csv --concurrency 4
```

**Expected**: the run finishes unattended. At least 95% of items are `ok` with no overrides, and
every failure appears in `ingest-report.json` with a reason. Fix failures with per-item overrides
and rerun. Already-imported items are skipped.
