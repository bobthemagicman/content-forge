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
| Licensed Aeonik files (`Aeonik-Regular.woff2`, `.woff`) | Placed in `src/app/fonts/` on your machine. Git ignores them: the license doesn't allow publishing them in this public repo (see §2, step 5) |
| Logo SVG | Placed in `public/brand/` |

## 2. One-time bootstrap (documented exceptions to "everything as code")

1. **Edge certificate**: `cd infra/edge-cert && npm ci && npx cdk deploy -c assetsDomain=assets.<domain>
   -c hostedZoneId=<zone id> --profile <p>`. Note the output `AssetsCertArn`.
2. **Signing keys**: `scripts/bootstrap/create-signing-keys.sh --env master --profile <p>`.
   - It writes the private key to SSM `/content-forge/master/cloudfront/private-key` (SecureString).
   - It writes the public key to `amplify/custom/assets-cdn/keys/master.public-key.pem`. Commit that
     file. Public keys aren't secret.
3. **Google OAuth client**: a Web application client, consent screen Internal; authorized
   redirect URI `https://<cognito-domain>/oauth2/idpresponse` (the Cognito domain appears after the
   first deploy; update it then). Cognito registers it as the OIDC provider `GoogleWorkspace`
   (research R3), which needs nothing extra on Google's side.
4. **Amplify app**: connect the GitHub repo `bobthemagicman/content-forge` in `us-west-2`. Set:
   - secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`;
   - env vars `ASSETS_CERT_ARN`, `HOSTED_ZONE_ID`, and `BUDGET_ALERT_EMAIL` (where the $5 budget
     alert goes);
   - env vars `ALLOWED_EMAIL_DOMAIN` (the Workspace domain allowed to sign in), `APP_ORIGIN`
     (`https://content.<domain>`), and `ASSETS_DOMAIN` (`assets.<domain>`; set `HOSTED_ZONE_NAME`
     too if the zone isn't its parent domain). They default to the `example.com` placeholders
     (`amplify/config.ts`), so a deploy without them only admits `@example.com`;
   - env `NEXT_PUBLIC_DEMO_MODE=0`, so the front end uses Cognito instead of the beta preview's
     simulated sign-in;
   - the custom domain `content.example.com` → branch `master`.

   Then apply the response headers (CSP, HSTS, ...) and the 404 rewrite, which name the asset host
   and so aren't committed: `ASSETS_DOMAIN=assets.<domain> scripts/hosting/apply-settings.sh
   --app-id <id> --profile <p>`. **Rerun it whenever `ASSETS_DOMAIN` changes**: the CSP names the
   asset host, and nothing else updates it. Add `--check` to compare the app's settings with the
   committed ones without changing anything (exit 1 on drift, for example after a console edit).

   Confirm the platform/framework setting from research R2.
5. **Licensed fonts**: upload `Aeonik-Regular.woff2` and `Aeonik-Regular.woff` to a private S3
   prefix you control (for example `s3://<private-bucket>/content-forge/fonts/`; block public
   access). Set the Amplify env var `FONTS_S3_URI` to that prefix and give the Amplify service
   role `s3:GetObject` on it. The Amplify build copies them into `src/app/fonts/` (T026). Never
   commit them.

## 3. Local development

```bash
npm ci
scripts/bootstrap/create-signing-keys.sh --env sandbox-$(whoami) --profile <p>   # once per sandbox
npx ampx sandbox secret set GOOGLE_CLIENT_ID --profile <p>       # once per sandbox
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET --profile <p>   # once per sandbox
ALLOWED_EMAIL_DOMAIN=<domain> npx ampx sandbox --profile <p>      # writes amplify_outputs.json
NEXT_PUBLIC_DEMO_MODE=0 npm run dev                              # http://localhost:3000
```

Plain `npm run dev` runs the beta preview: simulated sign-in on the demo catalog. Without a sandbox,
`predev`/`prebuild` copy the E2E fixture to `amplify_outputs.json` so the build still works;
`ampx sandbox` overwrites it with the real file.

The sandbox's environment name is `sandbox-<OS username>`. If your username has characters other
than letters, digits, `.`, `_` and `-`, synth stops with an error: pick a name and set it for both
commands, `--env sandbox-<name>` and `AWS_BRANCH=sandbox-<name> npx ampx sandbox ...`.

Sandboxes use their own bucket, table, Cognito pool, and signing keys. Commit the sandbox's
`keys/sandbox-<user>.public-key.pem`. The callback and logout URLs for `http://localhost:3000` are in
`defineAuth`.

Sandbox assets are served from the distribution's `*.cloudfront.net` domain with cross-site cookies,
and there's no budget or custom domain (research R19). **Use Chrome for local development.**
Browsers that block third-party cookies won't show sandbox previews. Demos work in every browser,
because their cookies are set on the demo host itself (research R20).

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
| V2 | Allowed sign-in | Sign in with an `@example.com` account, then look the user up in the Cognito console | Arrive at `/browse/`. Header shows name/avatar. The user has `custom:hd = example.com` | US1-2, FR-014, R3 |
| V3 | Personal account rejected | Sign in with a personal Gmail | Google's own "can only be used within its organization" page (the Internal consent screen stops it first). If it ever gets past Google: back on `/` with "authorized accounts only", and no user in the pool | US1-3, FR-001/002, SC-002 |
| V4 | Direct access denied | Signed out: `curl -I https://assets.example.com/v/<id>/thumb-320.<hash>.webp`, replay an expired download URL, and POST a `listContentByTypeAndPublishedAt` query to the AppSync URL with no token | `403` for the assets, `401` from AppSync | US1-6, FR-005, SC-002 |
| V5 | Rows | On `/browse/`, Tab into a row and use arrow keys and the next button | One row per non-empty type in the fixed order. Keyboard moves card to card | US2, FR-007–FR-011 |
| V6 | Detail + download | Open a card, then Download. Repeat with the largest archive in the library (multi-GB) | Detail facts shown. Download starts within 1 s and saves with its original name. The large file completes and its checksum matches the original. `downloadCount` +1 each time | US3, FR-015–FR-020, SC-001, SC-005 |
| V7 | Link expiry | Copy the signed URL from devtools and retry after 6 min | `403` | FR-018, SC-005 |
| V8 | Live demo | On the template, select Live Demo | Template renders with CSS/JS/images in a new tab on the demo host (`*.cloudfront.net`, not `assets.`) | US5, FR-026 |
| V9 | Demo isolation | In the demo tab's console: `localStorage.length`, `window.opener`, then `fetch('https://content.example.com/')`; then open the demo URL without the launch link in a private window | No app tokens visible, `opener` is `null`, cross-site read blocked; the direct URL gets `403` | FR-027, FR-005 |
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
