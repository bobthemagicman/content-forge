# Research: Content Forge MVP

**Feature**: `001-content-forge-mvp` | **Date**: 2026-10-27 | **Plan**: [plan.md](./plan.md)

Technical input: `docs/requirements/content-forge-mvp.md` (v4). Facts were checked against the Next.js
16.4 docs bundled in `node_modules/next/dist/docs/`, the Amplify Gen 2 docs and source
(`@aws-amplify/backend` 1.25.x), and the React Aria docs (`react-aria-components` 1.22.x). Items
marked **Verify in spike** depend on hosting behavior that can only be confirmed by deploying, and
they're the first tasks of implementation.

---

## R1. Next.js static export configuration

- **Decision**:
  - Set `output: 'export'` and `trailingSlash: true`, and `images.loader: 'custom'` with
    `images.loaderFile: './src/lib/assets/image-loader.ts'`.
  - **Remove `cacheComponents` and `partialPrefetching`** from the scaffold's `next.config.ts`.
  - Keep `reactCompiler: true` and the existing Tailwind/Turbopack rule.
- **Rationale**:
  - The static-exports guide lists what export doesn't support: route handlers that read the request,
    cookies, rewrites/redirects/headers, `proxy.ts`, ISR, server actions, the default image loader, and
    dynamic routes without `generateStaticParams`.
  - Cache Components "requires the Node.js runtime", and Partial Prefetching builds on it. Neither
    helps a site whose data is all fetched on the client.
  - `trailingSlash: true` emits `route/index.html`, so plain static hosting resolves routes without
    rewrites.
  - `useSearchParams` (needed by `/content?slug=`) has to sit inside a `<Suspense>` boundary so the
    rest of the page still prerenders.
- **Alternatives considered**:
  - Keeping `cacheComponents`: no benefit, and there's a risk of build errors under export.
  - `next/image` with `unoptimized: true`: loses responsive `srcset` for the pre-generated sizes.

## R2. Amplify Hosting for a static export

- **Decision**:
  - Host as a **static app** (platform `WEB`): `amplify.yml` builds with `npm run build` and
    publishes `artifacts.baseDirectory: out`.
  - The backend phase runs `npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID`.
  - Security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
    `frame-ancestors 'none'`) are set with `customHeaders` in `amplify.yml`. The CSP itself is
    defined in R18.
  - A rewrite sends unknown paths to `/404.html` with status 404.
  - Pin Node 24 in the build image (`nvm install 24 && nvm use 24` in `preBuild`).
- **Rationale**: Amplify docs say an `out` base directory means a static deployment, and
  `customHeaders` in `amplify.yml` keeps headers in code (Principle III).
- **Verify in spike**: Amplify's docs also say Next.js 14+ "SSG only" apps must use `WEB_COMPUTE`.
  That note is about Amplify's own Next.js adapter, and the platform choice needs confirming on the
  first deploy.
  - If `WEB` with `out` serves correctly, keep it.
  - Otherwise set the app framework to plain "Web" (no Next.js detection) so Amplify treats `out` as
    generic static files.

  Either way no SSR compute is used.
- **Alternatives considered**:
  - S3 + CloudFront hosting defined by hand in CDK: more infrastructure to own.
  - Amplify SSR (`WEB_COMPUTE` with server): violates Principle III.

## R3. Authentication: Cognito + Google Workspace

- **Decision**:
  - `defineAuth` with `externalProviders.google` (`clientId`/`clientSecret` from Amplify
    `secret()`), scopes `openid email profile`, and `attributeMapping` for email, name, picture.
  - Callback URL `https://content.example.com/auth/callback/` plus a localhost equivalent for
    sandboxes. Logout URL `/`.
  - A `preSignUp` trigger (`amplify/auth/pre-sign-up/`) rejects any email that doesn't end in
    `@example.com`, for every trigger source including `PreSignUp_ExternalProvider`.
  - The Google OAuth consent screen is set to **Internal** (defense in depth).
  - Self-service sign-up is turned off (`allowAdminCreateUserOnly: true` through a CDK override), and
    the UI only calls `signInWithRedirect({ provider: 'Google' })`.
  - Tokens use Amplify's default storage (app-origin `localStorage`). The refresh-token lifetime is
    7 days.
- **Rationale**:
  - Amplify's documented email-domain-filtering pattern is a pre-sign-up trigger, which runs server
    side (Principle II).
  - Google's `hd` parameter can't reliably be passed through the Cognito Hosted UI, so the
    Internal consent screen plus the trigger replace it.
  - A trigger error makes Cognito redirect to the callback with `error_description`, which the
    callback page maps to the "authorized accounts only" message.
- **Verify in spike**: that `allowAdminCreateUserOnly` doesn't block first-time federated
  sign-in. If it does, leave self-sign-up on. The pre-sign-up trigger still enforces the domain, and
  no password UI is exposed.
- **Alternatives considered**:
  - Auth.js: needs a server, so it's rejected for static export.
  - Cognito custom domain (`auth.example.com`): needs another us-east-1 cert. The Cognito prefix
    domain is fine for a private tool.

## R4. Catalog data model on Amplify Data (AppSync + DynamoDB)

- **Decision**:
  - One Amplify Data model, `Content`, with `allow.authenticated().to(['read'])`. There's no create,
    update or delete through the API.
  - Secondary indexes:
    - `bySlug` (`slug`), used by the detail page;
    - `byTypeAndPublishedAt` (`type` + `publishedAt`), used for browse rows.
  - **Drafts have no `publishedAt` attribute**, so they never appear in the sparse type index. Rows
    need no status filter, and pagination with `limit` stays accurate.
  - Download events go in a separate DynamoDB table that isn't part of the API (R9).
  - The model calls `.disableOperations(['mutations', 'subscriptions', 'queries'])`, so Amplify
    doesn't generate `getContent`/`listContents` (which would return drafts) or any write or
    subscription operations. Only the two index queries and `getDownloadUrl` remain.
- **Verify in spike**:
  - That the secondary-index queries survive `disableOperations(['queries'])`. If they don't,
    disable only `mutations` and `subscriptions`, and record in the spec that drafts are visible
    to signed-in users through the API (they aren't secret).
  - That an enum field (`type`) works as an index partition key. If it doesn't, store `type` as
    `a.string()` validated against `CONTENT_TYPES` by ingest.
- **Rationale**:
  - Users only read. All writes come from the owner's ingest or from the download Lambda, which
    gives least privilege.
  - A sparse GSI avoids the "filter after limit" problem that would return short pages.
- **Alternatives considered**:
  - A single-table design outside Amplify Data: loses generated typed clients and AppSync auth.
  - A status filter on the index: short or empty pages.

## R5. How ingest writes data

- **Decision**:
  - The ingest CLI runs with the owner's AWS credentials (named profile). It writes **directly** to S3
    (`@aws-sdk/lib-storage` multipart `Upload`) and to the `Content` DynamoDB table
    (`@aws-sdk/lib-dynamodb`).
  - It sets the Amplify-managed attributes (`id`, `__typename: 'Content'`, `createdAt`, `updatedAt`)
    itself.
  - Table and bucket names come from `amplify_outputs.json` → `custom` (exported with
    `backend.addOutput`).
- **Rationale**:
  - AppSync IAM write auth for an external role adds configuration for no benefit. Direct writes are
    simple, fast for hundreds of items, and limited to the owner's IAM identity (FR-040).
  - Multipart upload handles multi-GB archives.
- **Alternatives considered**:
  - An admin Cognito group with GraphQL mutations: needs an interactive OAuth login from a CLI.
  - An ingest Lambda: violates "heavy processing on the owner's machine" (Principle I).

## R6. Asset delivery: private bucket + CloudFront on `assets.example.com`

- **Decision** (production; other environments differ as described in R19):
  - A custom CDK construct `AssetsCdn` in `backend.createStack('assets')` owns:
    - the **S3 bucket**: block public access, Intelligent-Tiering lifecycle for `a/`, SSE-S3;
    - the **CloudFront distribution**: OAC to S3, custom domain + ACM cert from R10, Route 53 alias;
    - the **trusted key group**;
    - the **session Lambda** + function URL;
    - the **`DownloadEvents` table**;
    - an **AWS Budget** ($5/month, created only in the `master` environment; see R19);
    - log retention.
  - Behaviors:
    - `/v/*` (previews + demos): trusted key group, CachingOptimized, long TTL. Keys are
      content-hashed (R14), so objects are immutable.
    - `/a/*` (archives): trusted key group, CachingDisabled, so archives are never cached at the edge.
    - `/_session*`: Lambda function URL origin with OAC, CachingDisabled. The origin request policy
      forwards `X-Id-Token` and `Origin`. A response headers policy sends CORS for
      `https://content.example.com` with credentials.
  - Amplify `defineStorage` is **not** used.
- **Rationale**:
  - The client never uses Amplify Storage APIs; every read goes through CloudFront.
  - Putting the bucket and distribution in one stack avoids the circular dependency between an OAC
    bucket policy and the distribution, which appears when the bucket lives in Amplify's storage
    stack.
  - Archives and media on one distribution share the always-free CloudFront transfer allowance.
- **Alternatives considered**:
  - Amplify Storage `getUrl()` presigned S3 URLs: thumbnails can't be cached because each URL is
    unique, and egress is billed at S3 rates.
  - Two distributions: more resources for no isolation gain.

## R7. Asset session endpoint (signed cookies)

- **Decision**:
  - `GET https://assets.example.com/_session` with header `X-Id-Token: <Cognito ID token>`,
    called with `fetch(..., { credentials: 'include' })`.
  - The Lambda verifies the token with `aws-jwt-verify` (user pool, client ID, `token_use=id`) and
    checks the `email` domain. It then returns `204` with three `Set-Cookie` headers:
    `CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id`.
  - Cookie attributes in production: `Domain=assets.example.com; Path=/; Secure; HttpOnly;
    SameSite=Lax`, 12 h expiry. Personal environments use cross-site cookies instead (R19).
  - `GET /_session/signout` clears the cookies.
  - The function URL uses `AuthType AWS_IAM` behind **OAC**, so it can't be invoked directly.
    Reserved concurrency is 5 to cap abuse cost.
- **Rationale**:
  - Cookies for `assets.` have to be set by a response from `assets.`.
  - `content.` and `assets.` are **same-site** (same registrable domain), so `SameSite=Lax` cookies
    are first-party and get sent on `<img>`, `<video>` and new-tab demo requests. That avoids
    third-party-cookie blocking.
  - The token travels in a custom header because OAC signs the origin request with SigV4 in the
    `Authorization` header, so a viewer's `Authorization` header can't reach the origin.
  - Using GET means there's no request body, which avoids OAC's payload-hash requirement for Lambda
    URL POSTs. Because of the custom header and CORS, a cross-site page can't trigger it.
- **Alternatives considered**:
  - Lambda@Edge JWT check on every request: per-request cost and edge deployment complexity.
  - A public function URL (`AuthType NONE`): works, but can be invoked by anyone. OAC is stricter.

## R8. Signing keys, URLs, and cookies

- **Decision**:
  - Create an RSA-2048 key pair once **per environment** (`master`, and each personal sandbox
    `sandbox-<username>`) with `scripts/bootstrap/create-signing-keys.sh --env <env>`.
    - The **private key** goes to SSM Parameter Store SecureString
      `/content-forge/<env>/cloudfront/private-key`.
    - The **public key** PEM is committed at
      `amplify/custom/assets-cdn/keys/<env>.public-key.pem`. `backend.ts` reads the file for the
      current environment and passes it to `AssetsCdn`, which feeds it to `cloudfront.PublicKey` →
      `KeyGroup`. Synth fails with a pointer to the bootstrap script if the file is missing.
  - The key-pair ID is written to SSM `/content-forge/<env>/cloudfront/key-pair-id` by the stack.
  - Separate keys mean a sandbox Lambda can never sign cookies or URLs that production accepts.
  - Both Lambdas read SSM at cold start and cache the values.
  - `@aws-sdk/cloudfront-signer`:
    - `getSignedCookies` with a **custom policy**, resource `https://assets.example.com/v/*`,
      `DateLessThan` = now + 12 h;
    - `getSignedUrl` with a **canned policy**, single archive URL, expires now + 5 min (FR-018).
  - The download filename comes from `Content-Disposition: attachment; filename*=UTF-8''<name>`,
    stored as S3 object metadata at upload.
- **Rationale**:
  - CloudFormation can't create SecureStrings, so a documented one-time bootstrap is allowed
    (Principle III).
  - A public key isn't a secret.
  - Object metadata avoids forwarding `response-content-disposition` query strings through CloudFront.
- **Alternatives considered**:
  - Secrets Manager: $0.40/secret/month (Principle I).
  - An Amplify `secret()`: only available to `defineFunction` and not to custom-stack constructs
    without extra plumbing.

## R9. Download flow

- **Decision**:
  - The Amplify Data custom query `getDownloadUrl(contentId: ID!)` is backed by the
    `get-download-url` function (`defineFunction`, `runtime: 24`, `resourceGroupName: 'data'`).
  - The handler:
    1. reads the caller's `email` claim from the AppSync identity;
    2. `GetItem`s the `Content` record, which must exist and be published;
    3. **in parallel**, writes a `DownloadEvents` item (`contentId`, `downloadedAtEmail` =
       `<ISO>#<email>`) and runs `UpdateItem ADD downloadCount :1` on `Content`;
    4. signs and returns the URL plus `expiresAt`.

    If logging fails, the error is recorded and the URL is still returned (FR-020).
  - The client navigates to the URL (`window.location.assign`), so the browser downloads straight
    from CloudFront.
- **Rationale**:
  - `resourceGroupName: 'data'` follows Amplify's guidance for resolver functions, which avoids
    data↔function stack cycles.
  - The function gets table names via `addEnvironment`, and IAM via `grantReadWriteData` (Content)
    and `grantWriteData` (DownloadEvents).
  - The CloudFront domain and key-pair ID come from SSM paths, not cross-stack references, so stacks
    stay decoupled.
- **Alternatives considered**:
  - Logging on the client followed by a cookie-authorized archive path: the client could skip the
    logging step.

## R10. Certificate for `assets.example.com` (us-east-1)

- **Decision**:
  - A tiny standalone CDK app `infra/edge-cert/` (one stack, `env.region = 'us-east-1'`) creates an
    ACM certificate for `assets.example.com`, DNS-validated in the Route 53 zone for
    `example.com`.
  - It's deployed once (`npx cdk deploy` from that folder).
  - Its ARN is set as Amplify environment variable `ASSETS_CERT_ARN`. The hosted zone ID is set as
    `HOSTED_ZONE_ID`. `AssetsCdn` reads both at synth.
- **Rationale**:
  - CloudFront requires certificates in us-east-1.
  - Amplify Gen 2 custom stacks are **nested stacks** of the us-west-2 root stack, so they can't
    deploy to another region.
  - A separate CDK app keeps the certificate in code (Principle III).
- **Alternatives considered**:
  - Creating the certificate by hand in the console: violates Principle III.
  - A cross-region custom resource: more moving parts.

## R11. Front-end data access and session state

- **Decision**:
  - The `aws-amplify` v6 `generateClient<Schema>()` client lives in `src/lib/data/`. Small typed
    functions (`listRow(type, nextToken)`, `getBySlug(slug)`, `getDownloadUrl(id)`) are wrapped in
    React hooks built on `useEffect` and `useState`.
  - No server-state library is used.
  - An `AuthProvider` in the `(app)` layout:
    1. configures Amplify once;
    2. resolves `fetchAuthSession()`;
    3. redirects to `/` if there's no session;
    4. calls `/_session` and blocks rendering of catalog UI until the cookie is set;
    5. refreshes the cookie at 11 h and on the first asset `403`/`error` event, retrying once.
- **Rationale**: The MVP's data needs (paged reads, one mutation-like query) are small, so it needs no
  extra dependency (Principle VI).
- **Alternatives considered**: TanStack Query or SWR: worth adding later if caching or invalidation
  gets complex.

## R12. Category rows with React Aria

- **Decision**:
  - Each row is a React Aria **`GridList` with `orientation="horizontal"`**. Items are
    `GridListItem` with `href` (`/content?slug=…`).
  - `RouterProvider` (in the root client providers) is wired to Next's `useRouter().push`, so React
    Aria links use client-side navigation.
  - The GridList is one Tab stop and arrow keys move between cards (FR-009). Previous/next `Button`s
    scroll the container by one viewport width.
  - "Load more" uses the collection's load-more sentinel (`GridListLoadMoreItem`, or `onLoadMore` if
    the installed version exposes it). It fetches the next page with the stored `nextToken`.
  - Scrolling uses `scroll-behavior: smooth`, except under `prefers-reduced-motion`.
- **Rationale**:
  - The React Aria docs show `GridList` and `ListBox` supporting `orientation="horizontal"`, with
    keyboard navigation that matches the layout.
  - `GridList` (not `ListBox`) is for items that contain interactive content or links.
- **Alternatives considered**:
  - A hand-rolled carousel: re-implements accessibility.
  - `Virtualizer`: unnecessary at ≤ hundreds of items per row. Add it later if needed.

## R13. Images and fonts

- **Decision**:
  - `next/image` with a custom loader maps the requested `width` to the nearest pre-generated size
    (320/640/1280) under `https://assets.example.com/v/<id>/…`. The component passes
    `thumbKeys['320']` as `src`, and the loader swaps the `thumb-320` segment for the chosen width.
    This works because every generated file of one import shares one hash (R14).
  - Images that aren't catalog assets (the Google profile picture in the header) use
    `next/image` with `unoptimized`, which bypasses the loader.
  - Fonts:
    - **Aeonik**: self-hosted with `next/font/local`. The owner supplies the licensed WOFF2 files to
      `src/app/fonts/`.
    - **Lato**: `next/font/google`, downloaded at build time and self-hosted in the export.
- **Rationale**: Gives responsive images with no optimizer, and fonts load without third-party
  requests, so the CSP can keep `font-src 'self'` (R18).
- **Alternatives considered**: a raw `<img srcset>`: triggers the `@next/next/no-img-element` lint
  rule.

## R14. Ingest pipeline toolchain

- **Decision**: a Node 24 + TypeScript CLI in `tools/ingest/`, run with `tsx` and parsed with
  `node:util` `parseArgs`. It has a small in-house promise pool for concurrency, defaulting to 4.

  | Concern | Tool / approach |
  |---|---|
  | Zip reading | `yauzl` (streaming). Rejects absolute paths and `..` segments. Max 10 GB total uncompressed and 200k entries per archive. Recurses into nested `.zip` up to depth 3 |
  | Type detection | Rules from FR-031. Override from manifest/sidecar |
  | Website screenshots | `node:http` static server over the extracted folder, plus Playwright Chromium screenshots at 1440×900 and 390×844, `waitUntil: 'networkidle'` with a 15 s timeout |
  | PowerPoint | `soffice --headless --convert-to pdf`, then `pdftoppm -png -r 96 -f 1 -l 12`, then `sharp` → WebP. Fonts bundled in the package are installed to a temporary fontconfig dir for the conversion |
  | Video | `ffprobe -show_format -show_streams -of json`. Poster: `ffmpeg -ss <10%> -frames:v 1`. Preview: `ffmpeg -t 30 -vf scale=-2:720 -c:v libx264 -crf 28 -preset veryfast -an -movflags +faststart` |
  | Images/textures | `sharp` → WebP 320/640/1280 (and 2048 for detail), dimensions recorded |
  | Keys | `v/<id>/<name>.<importHash>.<ext>`. `importHash` is 8 hex chars, generated once per item per import run (SHA-256 of the source hash plus the run's start time) and shared by all of that item's generated files. Every re-import, including `--force`, gets new keys, so cached objects are never overwritten and stay immutable. Superseded keys are deleted after the record is written. Archives go to `a/<id>/<originalFilename>` |
  | Identity | `slug` = kebab-case of the title or filename (overridable). Re-imports look up `bySlug` and keep the existing `id` (FR-037, SC-009) |
  | Resume | `.ingest-state.json`, holding a per-item content hash and completed steps |
  | Report | `ingest-report.json` + a console summary |

- **Rationale**: Processing runs locally, so cloud compute costs nothing (Principle I). Every tool is
  standard and scriptable.
- **Verify locally**: LibreOffice (`brew install --cask libreoffice`) and poppler
  (`brew install poppler`) aren't installed yet. ffmpeg is installed. Startup checks report missing
  tools (FR-039).
- **Alternatives considered**:
  - `unzipper`: fewer safety controls.
  - Running conversions in Lambda containers: cost, plus LibreOffice cold starts.

## R15. Testing strategy

- **Decision**:

  | Layer | Tooling | Scope |
  |---|---|---|
  | Unit | Vitest, `aws-sdk-client-mock` | Pre-sign-up domain check, session token verification and cookie policy, download handler (logging failure still returns URL), ingest detection, zip sanitization, slug/key generation |
  | Component | Vitest + jsdom + React Testing Library + `@testing-library/user-event` | `ContentCard`, `CategoryRow` keyboard/scroll controls, detail actions by type, not-found, empty states |
  | E2E (CI) | Playwright against the built `out/` with the **backend mocked** (`page.route` for AppSync GraphQL, `/_session`, and asset URLs; fake Amplify session injected) | All browser journeys. The P1 specs (US1–US3) run in Chromium, Firefox, and WebKit (FR-042). Everything else runs in Chromium |
  | E2E (ingest, CI) | Vitest calling the CLI's exported `main(argv)` on `tests/fixtures/ingest/` with real extraction, detection, and preview generation (ffmpeg, LibreOffice, poppler, Playwright Chromium). S3 and DynamoDB are mocked at the SDK boundary with `aws-sdk-client-mock` | US4 (P1) end to end, per constitution Principle V. A separate CI job runs it when `tools/ingest/**` or the fixtures change |
  | E2E (smoke, deployed) | Playwright with a saved `storageState` from one real Workspace login | Sign-in → browse → detail → download → demo on a real environment. Run manually or on a schedule |
  | Accessibility | `@axe-core/playwright` | `/`, `/browse/`, `/content/?slug=…`: zero violations (SC-007) |
  | Infra | `aws-cdk-lib/assertions` on `AssetsCdn` (synthesized in an isolated `App`, in both production and personal mode) and on `infra/edge-cert` | Public access blocked, OAC present, trusted key groups on `/v/*` and `/a/*`, no `AWS::EC2::NatGateway` or VPC config, budget present only in production, log retention set. A guard test checks that every `defineFunction` sets 14-day log retention |
  | Ingest fixtures | Small fixture archives in `tests/fixtures/ingest/` (nested-zip template, zipped `.pptx`, short video, image, texture) | `--dry-run` classification in the primary CI job, plus the full run in the ingest E2E job |

- **Rationale**:
  - Real Google sign-in can't be automated reliably in CI, so CI mocks the backend at the network
    boundary and a deployed smoke test covers the real integration (Principle V).
  - Security-relevant rejection paths are unit-tested.
- **Alternatives considered**: a Cognito password test user: would mean enabling password login,
  which widens the attack surface.

## R16. Runtime versions

- **Decision**:
  - Node.js 24 LTS everywhere: local, Amplify build image, `defineFunction({ runtime: 24 })`, and
    CDK `Runtime.NODEJS_24_X` for the session Lambda.
  - Add `"engines": { "node": ">=24" }`.
- **Rationale**: Amplify's `NodeVersion` type accepts 24. Node 24 is the current Active LTS and is
  installed locally (v24.5.0).

## R17. Monthly cost estimate (Principle I)

| Resource | Basis (private, < 50 users, hundreds of items) | Est. $/month |
|---|---|---|
| Amplify Hosting (static) | A few builds/month, small transfer | ≤ $0.50 |
| Cognito user pool | < 50 MAU, within free MAU | $0 |
| AppSync | < 100k requests | ≤ $0.40 |
| DynamoDB on-demand (2 tables) | Tiny reads/writes, < 25 GB | ≤ $0.10 |
| Lambda (3 functions) | < 100k invocations | $0 (always-free tier) |
| CloudFront | < 1 TB transfer, < 10M requests | $0 (always-free tier) |
| SSM Parameter Store (standard) | 2–4 params | $0 |
| Route 53 | Existing zone, alias queries free | $0 incremental |
| ACM certificate | Public cert | $0 |
| CloudWatch Logs | 14-day retention, low volume | ≤ $0.10 |
| **S3 storage** | ~100 GB (Intelligent-Tiering for archives) | **~$1.50–2.50** |
| **Total** | | **≈ $1–3 (storage-dominated)** |

No item is estimated above $1/month except S3 storage, which the spec accepts ("excluding file
storage", SC-008). *Verify figures against current AWS pricing before launch.*

## R18. Content-Security-Policy for a static export

- **Decision**: `amplify.yml` `customHeaders` sends this policy on every page of the production app:

  ```text
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://assets.example.com https://*.googleusercontent.com;
  media-src https://assets.example.com;
  font-src 'self';
  connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com https://assets.example.com;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```

  T123 later narrows `connect-src` to the exact AppSync and Cognito hosts.
- **Rationale**:
  - Next.js static pages contain inline bootstrap scripts. Nonces need dynamic rendering, which a
    static export doesn't have, so the bundled guide's "Without Nonces" policy applies
    (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
  - React Aria sets inline `style` attributes, which needs `style-src 'unsafe-inline'`.
  - The header shows the user's Google profile picture, served from `*.googleusercontent.com`.
  - Mitigations for `'unsafe-inline'` scripts: React escapes output, the ESLint config forbids
    `dangerouslySetInnerHTML` (`react/no-danger`), and no third-party scripts are loaded.
- **Alternatives considered**:
  - Experimental SRI (`experimental.sri`): the guide shows it allowing a stricter
    `script-src 'self'`, but it's marked experimental ("may change or be removed") and it's
    unverified with `output: 'export'` on Amplify. Worth revisiting once it's stable. It still
    wouldn't remove the need for `style-src 'unsafe-inline'`.
  - Nonces: impossible without server rendering (Principle III).

## R19. Non-production environments

- **Decision**: there are two kinds of environment, chosen in `amplify/backend.ts` by
  `envName`: `process.env.AWS_BRANCH` when set, otherwise `sandbox-<os.userInfo().username>`.

  | Aspect | `master` (production) | Personal sandbox (`npx ampx sandbox`) |
  |---|---|---|
  | App origin | `https://content.example.com` (Amplify Hosting) | `http://localhost:3000` (`next dev`) |
  | Asset domain | `assets.example.com`: custom domain, us-east-1 cert, Route 53 alias | The distribution's own `*.cloudfront.net` domain. No cert, no DNS record |
  | Asset cookies | `Domain=assets.example.com; SameSite=Lax` (same-site) | Host-only (no `Domain`), `SameSite=None; Secure; HttpOnly` (cross-site) |
  | `/_session` allowed origin | `https://content.example.com` | `http://localhost:3000` |
  | Signing keys | `/content-forge/master/...`, `keys/master.public-key.pem` | `/content-forge/sandbox-<user>/...`, `keys/sandbox-<user>.public-key.pem` |
  | AWS Budget | Yes (one per account covers all environments) | No |
  | CSP headers | Yes (R18) | None (`next dev`) |

  - The Lambdas read the asset domain from SSM `/content-forge/<env>/assets/domain`, written by the
    stack. This avoids a dependency cycle between the distribution and the session function, whose
    URL is one of its origins.
  - The session handler gets `COOKIE_MODE=same-site|cross-site` from the construct.
  - Hosted preview branches aren't used in the MVP. Only `master` is connected to Amplify Hosting.
- **Rationale**:
  - Two distributions can't share one hostname, and a certificate and DNS record per sandbox is
    setup with no benefit.
  - `localhost` and `*.cloudfront.net` are different sites, so `SameSite=Lax` cookies would never
    be sent from local development.
  - A budget is account-wide. Creating it per environment would fail on the duplicate name.
- **Known limitation**: sandbox previews rely on third-party cookies. Browsers that block them
  (Safari, Firefox in strict mode) won't show sandbox previews or demos. Use Chrome for local
  development. Production isn't affected.
- **Alternatives considered**:
  - Per-sandbox subdomains (`<user>.assets.example.com`): still cross-site from `localhost`,
    plus a cert and DNS record for each.
  - One shared key pair: a sandbox function could then sign cookies production accepts.
