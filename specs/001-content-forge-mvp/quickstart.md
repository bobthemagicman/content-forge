# Quickstart & Validation Guide: Content Forge MVP

**Feature**: `001-content-forge-mvp` · **Plan**: [plan.md](./plan.md)

This guide covers how to set up, run, and **prove** the MVP works. Design details live in
[research.md](./research.md), [data-model.md](./data-model.md), and [contracts/](./contracts/).

---

## 1. Prerequisites

| Need | Check |
|---|---|
| Node.js 24 LTS | `node -v` → `v24.x` |
| Two AWS accounts (research R21), each with an admin profile for bootstrap: the **auth account** for the user pools, the **app account** for everything else. Both CDK-bootstrapped in `us-west-2` (`npx cdk bootstrap --profile <p>`) | `aws sts get-caller-identity --profile <p>` for each |
| Route 53 hosted zone for your domain (`example.com` throughout these docs) | `aws route53 list-hosted-zones-by-name --dns-name example.com` |
| Google Workspace admin access | Can create an **Internal** OAuth client in Google Cloud Console |
| Ingest tools (owner machine) | `ffmpeg -version`, `soffice --version`, `pdftoppm -v`. Install the missing ones: `brew install --cask libreoffice` and `brew install poppler` |
| Playwright browsers | `npx playwright install chromium firefox webkit` |
| Licensed Aeonik files (`Aeonik-Regular.woff2`, `.woff`) | Placed in `src/app/fonts/` on your machine. Git ignores them: the license doesn't allow publishing them in this public repo (see §2, step 5) |
| Logo SVG | Placed in `public/brand/` |

## 2. One-time bootstrap (documented exceptions to "everything as code")

Steps 1, 2, 4 and 5 run in the app account; step 3 is in Google Cloud and the auth account.

0. **Lambda concurrency quota** (app account): production reserves 5 concurrent executions for the session
   function, and Lambda keeps 10 unreserved, so the account needs a quota of at least 15. New
   accounts often start at 10. Check **Service Quotas → AWS Lambda → Concurrent executions** in
   `us-west-2`, and request 1000 (the usual default) if it's lower. Increases are free and usually
   approved within a day.

1. **Edge certificate**: `cd infra/edge-cert && npm ci && npx cdk deploy -c assetsDomain=assets.<domain>
   -c hostedZoneId=<zone id> --profile <p>`. Note the output `AssetsCertArn`.
2. **Signing keys**: `scripts/bootstrap/create-signing-keys.sh --env master --profile <p>`.
   - It writes the private key to SSM `/content-forge/master/cloudfront/private-key` (SecureString).
   - It writes the public key to SSM `/content-forge/master/cloudfront/public-key`, where synth
     reads it. Nothing is committed: deployment settings stay out of this repo (research R22,
     [`docs/deployment/settings.md`](../../docs/deployment/settings.md)).
3. **Google OAuth client and user pools** (research R3, R21):
   1. In Google Cloud, create a Web application client with the consent screen set to Internal.
      Cognito registers it as the OIDC provider `GoogleWorkspace`, which needs nothing extra on
      Google's side.
   2. Store it in the auth account: `scripts/auth/set-google-secret.sh --profile <auth p>`. It
      prompts for the client ID and secret, so neither lands in shell history.
   3. Deploy the pools to the auth account:

      ```bash
      ALLOWED_EMAIL_DOMAIN=<domain> scripts/auth/deploy.sh --env dev --auth-profile <auth p> --app-profile <app p>
      ALLOWED_EMAIL_DOMAIN=<domain> APP_ORIGIN=https://content.<domain> scripts/auth/deploy.sh --env prod --auth-profile <auth p> --app-profile <app p>
      ```

      Each writes the pool's IDs, domain, redirect origin and allowed email domain to the app
      account's SSM (`/content-forge/auth/<env>`), where synth reads them. The session function
      takes the allowed domain from there, so it always matches the pool's pre-sign-up check.
      Nothing is committed. Both default to `us-west-2`; pass `--region` for the auth account and
      `--app-region` for the app account.
   4. Add each pool's redirect URI, which the deploy prints
      (`https://<cognito-domain>/oauth2/idpresponse`), to the Google client's authorized redirect
      URIs.

   Rerun step 3 when the pool settings change, or the Google secret (then redeploy both pools).
   Then redeploy the app (or restart sandboxes) if the handover changed.
4. **Amplify app** (app account): connect the GitHub repo `bobthemagicman/content-forge` in
   `us-west-2`. Set:
   - env vars `ASSETS_CERT_ARN`, `HOSTED_ZONE_ID`, and `BUDGET_ALERT_EMAIL` (where the $5 budget
     alert goes);
   - env vars `APP_ORIGIN` (`https://content.<domain>`) and `ASSETS_DOMAIN` (`assets.<domain>`;
     set `HOSTED_ZONE_NAME` too if the zone isn't its parent domain). Production refuses to synth
     without them. The allowed email domain comes from the `prod` pool's settings (step 3), not an
     env var;
   - env `NEXT_PUBLIC_DEMO_MODE=0`, so the front end uses Cognito instead of the beta preview's
     simulated sign-in;
   - on the Amplify service role, `ssm:GetParameter` on
     `arn:aws:ssm:<region>:<app account>:parameter/content-forge/*`. Synth reads the pool handover
     and the signing public key from there (research R22);
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
scripts/bootstrap/create-signing-keys.sh --env sandbox-$(whoami) --profile <app p>   # once per sandbox
npx ampx sandbox --profile <app p>                                 # writes amplify_outputs.json
NEXT_PUBLIC_DEMO_MODE=0 npm run dev                                # http://localhost:3000
```

Sandboxes deploy to the app account and sign in through the shared `dev` pool in the auth account
(research R21). Synth reads that pool's settings from the app account's SSM, where step 3 of §2 put
them, so nothing else needs setting up.

Plain `npm run dev` runs the beta preview: simulated sign-in on the demo catalog. Without a sandbox,
`predev`/`prebuild` copy the E2E fixture to `amplify_outputs.json` so the build still works;
`ampx sandbox` overwrites it with the real file.

The sandbox's environment name is `sandbox-<OS username>`. If your username has characters other
than letters, digits, `.`, `_` and `-`, synth stops with an error: pick a name and set it for both
commands, `--env sandbox-<name>` and `AWS_BRANCH=sandbox-<name> npx ampx sandbox ...`.

Sandboxes use their own bucket, table, and signing keys, and share the `dev` user pool.

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
| V2 | Allowed sign-in | Sign in with an `@example.com` account, then look the user up in the Cognito console. Then run the attribute-write check below | Arrive at `/browse/`. Header shows name/avatar. The user has `custom:hd = example.com`. Neither access token has `aws.cognito.signin.user.admin`, and both writes are refused | US1-2, FR-014, R3 |
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

### Attribute-write check (V2)

A signed-in user must not be able to rewrite their own `custom:hd` (research R3). Copy the tokens
through the clipboard so they never show on screen or in shell history. Read them by client ID:
after a sandbox is deleted and redeployed, `localStorage` still holds the old client's tokens, and
those fail with "Invalid Refresh Token".

In the signed-in app tab's devtools console, with `auth.user_pool_client_id` from
`amplify_outputs.json`:

```js
const p = "CognitoIdentityServiceProvider.<user_pool_client_id>.";
const u = localStorage.getItem(p + "LastAuthUser");
copy(localStorage.getItem(p + u + ".accessToken"));   // then ACCESS=$(pbpaste) in the terminal
copy(localStorage.getItem(p + u + ".refreshToken"));  // then REFRESH=$(pbpaste)
```

Then, in a terminal in the repo folder:

```bash
CLIENT_ID=$(node -p 'require("./amplify_outputs.json").auth.user_pool_client_id')
scopes() { node -e 'console.log(JSON.parse(Buffer.from(process.argv[1].split(".")[1], "base64url")).scope)' "$1"; }

# 1. The sign-in token: the scopes must not include aws.cognito.signin.user.admin.
scopes "$ACCESS"
aws cognito-idp update-user-attributes --no-sign-request --region us-west-2 --access-token "$ACCESS" \
  --user-attributes Name=custom:hd,Value=attacker.test   # expect NotAuthorizedException

# 2. A refreshed token, the way Amplify refreshes.
REFRESHED=$(aws cognito-idp get-tokens-from-refresh-token --no-sign-request --region us-west-2 \
  --client-id "$CLIENT_ID" --refresh-token "$REFRESH" --query AuthenticationResult.AccessToken --output text)
scopes "$REFRESHED"
aws cognito-idp update-user-attributes --no-sign-request --region us-west-2 --access-token "$REFRESHED" \
  --user-attributes Name=custom:hd,Value=attacker.test   # expect NotAuthorizedException

unset ACCESS REFRESH REFRESHED; pbcopy < /dev/null
```

These tokens act as you. Run the commands in your own terminal, don't paste the tokens anywhere
else, and sign out afterwards. If either write succeeds, `custom:hd` is no longer a server-side
check: stop and fix it before deploying `master`. Signing in again restores your real `custom:hd`.

## 7. Full library import (SC-003)

```bash
npm run ingest -- batch "<path-to-library>" --manifest library.csv --concurrency 4
```

**Expected**: the run finishes unattended. At least 95% of items are `ok` with no overrides, and
every failure appears in `ingest-report.json` with a reason. Fix failures with per-item overrides
and rerun. Already-imported items are skipped.

## 8. Offboarding a user

Suspending someone in Google Workspace doesn't end their Content Forge session: Cognito keeps
renewing it from its own 7-day refresh token (research R3). When someone leaves, also sign them out
everywhere and disable them in the user pool. Use the auth account's profile and the pool ID for
that environment. Read it from the app account's handover, with the app account's profile:
`aws ssm get-parameter --name /content-forge/auth/<dev|prod> --query Parameter.Value --output text`
prints the pool settings, including `userPoolId`.

```bash
PROFILE=<profile>
POOL_ID=<user pool ID>
USER=$(aws cognito-idp list-users --profile "$PROFILE" --region us-west-2 --user-pool-id "$POOL_ID" \
  --filter 'email = "person@example.com"' --query 'Users[0].Username' --output text)
echo "$USER"   # a GoogleWorkspace_<id> name; stop if it prints None

aws cognito-idp admin-user-global-sign-out --profile "$PROFILE" --region us-west-2 \
  --user-pool-id "$POOL_ID" --username "$USER"
aws cognito-idp admin-disable-user --profile "$PROFILE" --region us-west-2 \
  --user-pool-id "$POOL_ID" --username "$USER"
```

**Expected**: the refresh token stops working at once, so the app signs them out at its next
refresh. An ID token they already hold verifies for up to an hour, and asset and demo cookies last
up to 12 hours, so all access ends within about 13 hours. To let someone back in, run
`admin-enable-user` with the same arguments.
