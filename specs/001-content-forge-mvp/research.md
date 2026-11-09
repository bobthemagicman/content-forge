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
- **Outcome (first production deploy, 2026-11-08):** the console created the app as `WEB_COMPUTE`
  with the branch framework "Next.js - SSR", and that first build failed. With the platform set to
  `WEB` and the framework to plain "Web", the next build succeeded and serves `out/` as static
  files, with the 404 rewrite and the response headers from `scripts/hosting/apply-settings.sh`.
  Quickstart §2 step 4.3 has the commands.
- **Alternatives considered**:
  - S3 + CloudFront hosting defined by hand in CDK: more infrastructure to own.
  - Amplify SSR (`WEB_COMPUTE` with server): violates Principle III.

## R3. Authentication: Cognito + Google Workspace

- **Decision**:
  - A Cognito user pool in the auth account (R21), deployed by `infra/auth`, with Google as an
    **OIDC provider** named `GoogleWorkspace` (issuer `https://accounts.google.com`, client ID and
    secret from Secrets Manager), scopes
    `openid email profile`, and `attributeMapping` for email, `email_verified`, name, picture, and
    Google's hosted-domain claim `hd` → custom attribute `custom:hd`. The app signs in with
    `signInWithRedirect({ provider: { custom: 'GoogleWorkspace' } })`.
  - Callback URL `https://content.example.com/auth/callback/` on the `prod` pool, and
    `http://localhost:3000/auth/callback/` on the `dev` pool that sandboxes share (R21). Logout URL
    `/`.
  - A `preSignUp` trigger (`infra/auth/lib/pre-sign-up.ts`) admits only `PreSignUp_ExternalProvider`
    sign-ups whose `custom:hd` is `example.com`, whose email ends in `@example.com`, and whose
    email isn't unverified. Every other trigger source is refused.
  - The session function (R7) repeats the `custom:hd` check on every asset session and demo launch,
    so it also covers sign-ins after the first: Cognito rewrites mapped attributes each time.
  - The Google OAuth consent screen is set to **Internal** (defense in depth).
  - Self-service sign-up is turned off (`selfSignUpEnabled: false`), and the UI only calls `signInWithRedirect({ provider: { custom: 'GoogleWorkspace' } })`.
  - The app client gives out tokens only through Google (`infra/auth/lib/auth-stack.ts`, checked by
    `tests/infra/auth-stack.test.ts`):
    - the only identity provider is `GoogleWorkspace`, not `COGNITO`, so there's no Cognito sign-in
      form;
    - the only explicit auth flow is `ALLOW_REFRESH_TOKEN_AUTH`, so no SRP or custom auth;
    - OAuth allows only the code flow and the scopes `openid email profile`.
  - Tokens use Amplify's default storage (app-origin `localStorage`). The refresh-token lifetime is
    7 days.
- **Rationale**:
  - Amplify's documented email-domain-filtering pattern is a pre-sign-up trigger, which runs server
    side (Principle II).
  - Google's guidance is to check the `hd` claim, not the email domain alone: a consumer Google
    account can use an address in a Workspace domain, and only Workspace accounts carry `hd`.
  - Cognito's built-in Google provider reads Google's People API, which has no `hd` field. For OIDC
    providers, Cognito validates Google's ID token (signature, issuer, audience, expiry) and maps
    claims from it and from the userinfo response, so `hd` can be mapped. An account without it
    gets no `custom:hd`, and every check fails closed.
  - The `hd` **request parameter** is only a hint to Google's account picker, and can't reliably be
    passed through the Cognito Hosted UI, so it's not relied on. The Internal consent screen stays
    as a further layer.
  - A trigger error makes Cognito redirect to the callback with `error_description`, which the
    callback page maps to the "authorized accounts only" message.
  - **Users can't rewrite their own `custom:hd` or email** (2026-11-07 review). Cognito lets a user
    change their own attributes with `UpdateUserAttributes`, and requires the app client to have
    write access to every mapped attribute, or federated sign-in fails. So `custom:hd` and `email`
    stay writable. The guard is the scope instead: `UpdateUserAttributes` needs an access token with
    `aws.cognito.signin.user.admin`. SRP and custom-auth tokens always carry it, and the OAuth
    flow carries it only if requested. The client allows neither, and federated users have no
    password. Each Google sign-in also rewrites both attributes from Google's token.
- **Verify in spike**: that a Workspace account's first sign-in maps `custom:hd` (check the user's
  attributes in the user pool), and that a personal Gmail account is refused. Also that
  `allowAdminCreateUserOnly` doesn't block first-time federated
  sign-in. If it does, leave self-sign-up on. The pre-sign-up trigger still enforces the domain, and
  no password UI is exposed.
- **Spike outcome (2026-11-07, personal sandbox)**: a Workspace account's first Google sign-in
  created the user with `custom:hd` set to the Workspace domain, through the pre-sign-up trigger's
  stricter checks. So the OIDC mapping of `hd` works, and `allowAdminCreateUserOnly: true` doesn't
  block first-time federated sign-in. **Confirmed on `master` (2026-11-08, T054)**, with the
  `prod` pool in the auth account.
- **Verified on a sandbox (2026-11-07)**: Google sign-in works with these client settings. The
  sign-in access token and one from `GetTokensFromRefreshToken` both carry only `openid profile
  email`, and `UpdateUserAttributes` refuses both with `NotAuthorizedException` (quickstart V2). The
  docs don't say whether a refreshed token keeps the original scopes. This check shows it does.
  The same check passed in production against the `prod` pool (2026-11-09, T054).
- **Residual risk** (accepted 2026-11-07, after the PR #134 re-review): leaving the Workspace
  doesn't end access at once. Cognito renews a session from its own refresh token without asking
  Google, and the session function checks `custom:hd` and email, which change only at a Google
  sign-in. So a suspended account keeps working until its refresh token expires, up to 7 days, and
  its asset and demo cookies last up to 12 hours more.
  - Accepted because the catalog is internal and the users are one small team. A shorter refresh
    token would mean more sign-ins for everyone, to cover an event the owner can handle directly.
  - Offboarding (quickstart §8) signs the user out everywhere and disables them. That ends refresh
    at once. An ID token already issued still verifies for up to an hour and can get new 12-hour
    cookies, so access ends within about 13 hours.
- **Alternatives considered**:
  - Auth.js: needs a server, so it's rejected for static export.
  - Cognito custom domain (`auth.example.com`): needs another us-east-1 cert. The Cognito prefix
    domain is fine for a private tool.

## R4. Catalog data model on Amplify Data (AppSync + DynamoDB)

- **Decision**:
  - One Amplify Data model, `Content`, with `allow.authenticated().to(['read'])`. There's no create,
    update or delete through the API.
  - Secondary indexes:
    - `byPublishedSlug` (`publishedSlug`, sparse), used by the detail page;
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
- **Spike outcome (2026-11-06, local synth; T017)**: both hold. With mutations, subscriptions, and
  queries disabled, the transformer generates exactly `listContentBySlug` and
  `listContentByTypeAndPublishedAt`, with their resolvers and indexes, and no `getContent` or
  `listContents`. The `ContentType` enum works as the index partition key (stored as a DynamoDB
  `S` attribute).
  - **Correction (security review):** the first version indexed `slug` itself, and Amplify gives
    every index a public query, even without `queryField`, so `listContentBySlug` returned drafts.
    The slug index is now sparse too, on `publishedSlug`, which only published items carry.
    `slug` stays unindexed, and ingest checks slug uniqueness with a table scan.
  - Still to confirm against a deployed backend: that both queries answer (T054).
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
    - the **demo distribution** on its own `*.cloudfront.net` host (R20);
    - the **trusted key group**;
    - the **session Lambda** + function URL;
    - the **`DownloadEvents` table**;
    - an **AWS Budget** ($5/month, created only in the `master` environment; see R19);
    - log retention.
  - Behaviors:
    - `/v/*` (previews): trusted key group, CachingOptimized, long TTL. Keys are content-hashed
      (R14), so objects are immutable. Demos aren't served here (R20).
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
  - Separate distributions for previews and archives: more resources for no isolation gain. (Demos
    are the exception: they need a separate site, R20.)

## R7. Asset session endpoint (signed cookies)

- **Decision**:
  - `GET https://assets.example.com/_session` with header `X-Id-Token: <Cognito ID token>`,
    called with `fetch(..., { credentials: 'include' })`.
  - The Lambda verifies the token (user pool, client ID, `token_use=id`; `jose` against the pool's
    JWKS since specs/003 T136, `aws-jwt-verify` before) and
    checks the `email` domain. It then returns `204` with three `Set-Cookie` headers:
    `CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id`.
  - Cookie attributes in production: host-only, `Path=/v/; Secure; HttpOnly; SameSite=Lax`, 12 h
    expiry. Personal environments use cross-site cookies instead (R19).
  - `GET /_session/signout` clears the cookies.
  - The function URL uses `AuthType AWS_IAM` behind **OAC**, so it can't be invoked directly.
    Reserved concurrency is 5 to cap abuse cost, in production only: Lambda keeps 10 unreserved
    executions per account, so an account on the default quota of 10 can't reserve any (seen on
    the first sandbox deploy). Production's account needs a concurrency quota of at least 15
    (quickstart §2).
- **Rationale**:
  - Cookies for `assets.` have to be set by a response from `assets.`.
  - `content.` and `assets.` are **same-site** (same registrable domain), so `SameSite=Lax` cookies
    are first-party and get sent on `<img>` and `<video>` requests. That avoids third-party-cookie
    blocking.
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
    - The **public key** PEM goes to SSM String `/content-forge/<env>/cloudfront/public-key`.
      `backend.ts` reads it at synth for the current environment and passes it to `AssetsCdn`,
      which feeds it to `cloudfront.PublicKey` → `KeyGroup`. Synth fails with a pointer to the
      bootstrap script if it's missing. It isn't secret, but it belongs to one deployment, so it
      stays out of this public repo (R22). Until 2026-11-08 it was committed under
      `amplify/custom/assets-cdn/keys/`.
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
- **Outcome (T087, 2026-10-30)**: `react-aria-components` 1.22.1 exports `GridListLoadMoreItem`
  (`onLoadMore`, `isLoading`), so rows use it. Mixing it with dynamic items needs a
  `<Collection items>` inside the `GridList`. Toasts are still `UNSTABLE_`-prefixed in this version
  and are imported only in `src/components/ui/toast.tsx` (T032).

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
  | Identity | `slug` = kebab-case of the title or filename (overridable). Re-imports find the existing item by slug (a projected table scan) and keep its `id` (FR-037, SC-009) |
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
| Cognito user pools (auth account, R21) | < 50 MAU, within free MAU | $0 |
| Secrets Manager (auth account, R21) | 1 secret: the Google client | $0.40 |
| AppSync | < 100k requests | ≤ $0.40 |
| DynamoDB on-demand (2 tables) | Tiny reads/writes, < 25 GB | ≤ $0.10 |
| Lambda (3 functions) | < 100k invocations | $0 (always-free tier) |
| CloudFront (2 distributions, 2 functions) | < 1 TB transfer, < 10M requests, < 2M function invocations, shared across both | $0 (always-free tier) |
| SSM Parameter Store (standard) | 2–4 params | $0 |
| Route 53 | Alias queries free. $0 with an existing zone; a delegated `assets.<domain>` zone (quickstart §2 step 1) is $0.50 | $0–0.50 |
| ACM certificate | Public cert | $0 |
| CloudWatch Logs | 14-day retention, low volume | ≤ $0.10 |
| **S3 storage** | ~100 GB (Intelligent-Tiering for archives) | **~$1.50–2.50** |
| **Total** | | **≈ $1–3 (storage-dominated)** |

No item is estimated above $1/month except S3 storage, which the spec accepts ("excluding file
storage", SC-008). *Verify figures against current AWS pricing before launch.*

**What the budget counts (2026-11-08).** The app account may run other things, so the
`content-forge-monthly` budget counts only spending tagged `project=content-forge`. The backend
tags every resource it creates (`amplify/backend.ts`, sandboxes included), and the owner tags the
Amplify Hosting app. The tag must be activated as a cost allocation tag once (quickstart §2), or
the budget sees nothing. The auth account's lines (Cognito, the Google secret) are outside it:
that account has its own bill.

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
  It names the key file and the SSM parameters, so `amplify/environment.ts` accepts only `master`
  and `sandbox-[A-Za-z0-9._-]+`, the names the key script accepts, and stops synth otherwise (a
  branch such as `feature/x` would otherwise produce a nested parameter path no script can create).

  | Aspect | `master` (production) | Personal sandbox (`npx ampx sandbox`) |
  |---|---|---|
  | App origin | `https://content.example.com` (Amplify Hosting) | `http://localhost:3000` (`next dev`) |
  | Asset domain | `assets.example.com`: custom domain, us-east-1 cert, Route 53 alias | The distribution's own `*.cloudfront.net` domain. No cert, no DNS record |
  | Asset cookies | Host-only, `Path=/v/; SameSite=Lax` (same-site) | Host-only, `Path=/v/; SameSite=None; Secure; HttpOnly` (cross-site) |
  | `/_session` allowed origin | `https://content.example.com` | `http://localhost:3000` |
  | Demo host | The demo distribution's own `*.cloudfront.net` domain (R20) | The same, per sandbox |
  | Signing keys | SSM `/content-forge/master/cloudfront/...` | SSM `/content-forge/sandbox-<user>/cloudfront/...` |
  | AWS Budget | Yes (one per account covers all environments) | No |
  | Session function reserved concurrency | 5 | None (the account quota caps it) |
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
  (Safari, Firefox in strict mode) won't show sandbox previews. Use Chrome for local development.
  Production isn't affected, and demos work everywhere: their cookies are first-party (R20).
- **Alternatives considered**:
  - Per-sandbox subdomains (`<user>.assets.example.com`): still cross-site from `localhost`,
    plus a cert and DNS record for each.
  - One shared key pair: a sandbox function could then sign cookies production accepts.

## R20. Demo isolation: a separate site for template code

- **Decision**:
  - Template demos are served by a **second CloudFront distribution on its own `*.cloudfront.net`
    host**, in every environment, never a subdomain of the owner's domain. Its only origin is the
    asset bucket with origin path `/d`, so demo URLs are `https://<demo host>/<id>/<path>` →
    S3 `d/<id>/<path>`. A bucket policy statement also denies it any object outside `d/`.
  - The asset host stops serving demos. Previews stay on `assets.example.com`, where same-site
    cookies work in every browser (R7).
  - **Opening a demo** (contracts/assets-cdn.md):
    1. The app calls `GET https://assets.example.com/_session/demo/<id>` with the ID token, as for
       `/_session`. The session function checks the token, the domain and the `Origin`, then reads
       the item: it must be published and have a `demoEntryPath`, otherwise `404`.
    2. It signs a custom policy for `https://<demo host>/<id>/*` (12 h) and returns a launch link,
       `https://<demo host>/_launch/<id>/<entry>?p=…&s=…&k=…`, carrying the three cookie values.
    3. The app opens the link in a new tab. A CloudFront Function on `/_launch/*` sets the values as
       cookies scoped to `Path=/<id>/` and redirects to `/<id>/<entry>`. It verifies nothing:
       CloudFront checks the cookies against the key group on every demo request.
  - Cookies: host-only, `Path=/<id>/; Secure; HttpOnly; SameSite=Lax`, 12 h, the same lifetime as
    the preview session.
- **Rationale**:
  - `cloudfront.net` is on the Public Suffix List, so each distribution host is its own site. A
    hostile template can no longer set cookies on the owner's domain, send same-site requests to
    the company's other apps, or phish on a company hostname. That replaces the accepted risk
    recorded on 2026-11-07 (constitution 1.1.0, Principle II).
  - The cookies are set during a top-level navigation to the demo host, so they're first-party in
    every browser, including Safari and Firefox, which block or partition third-party cookies. A
    cookie handed out by the app's `fetch` would have been third-party.
  - **Automatable** (constitution Principle III): adding a demo is an upload under `d/<id>/` and a
    `demoEntryPath` on the record. Nothing about the distributions, DNS or certificates changes per
    demo, and the design doesn't depend on the content type, so other types can get hosted demos
    the same way.
  - Per-demo cookie paths mean a demo only receives its own cookies. Demos share one origin, so a
    demo can still read another demo the user opened in the last 12 hours, which FR-027 allows.
  - 12 hours, not shorter: a demo tab has no token, so it can't renew its own cookies, and FR-029
    requires open demos to keep working through a session. Reopening a demo from the app renews it.
  - No new secret, Lambda, or endpoint on the demo host: the same key group verifies both hosts,
    and every policy names its host, so a preview cookie can't open a demo or the reverse.
  - Cost: $0. Both distributions and both functions share CloudFront's always-free allowance (R17).
- **Residual risks** (accepted 2026-11-07, after the PR #134 review):
  - A launch link is a bearer credential for that one demo for 12 hours. Anyone who copies it, for
    example from browser history or a shared screen, can open that demo without signing in until it
    expires. It lives only in the app's memory and the new tab's first request, and the redirect
    keeps it out of referrers, but the browser may still record it in history.
  - Signing out doesn't end demo access. The demo cookies are on another site, so the app can't
    clear them, and they last until they expire.
  - Accepted because a link only opens one third-party template, not catalog data or downloads, and
    only a signed-in domain user can get one. A link shorter-lived than its cookies would need its
    own signature, checked in the CloudFront Function with a key in CloudFront KeyValueStore. That's
    machinery for a small gain. Shortening both to well under 12 hours would break open demos
    mid-session (FR-029).
  - Templates share the demo origin's storage (`localStorage`, cookies they set themselves). A
    template could break another template's demo, which costs nothing but a reopen.
  - Phishing is still possible on the demo host, but on a random `*.cloudfront.net` name that
    carries no company trust.
  - The demo host has no TLS 1.2 floor (2026-11-07 re-review). CloudFront applies a minimum
    protocol version only to a custom certificate, and the demo host always uses the default
    `*.cloudfront.net` one, which still accepts TLS 1.0 and 1.1. The same holds for a sandbox's
    asset host. It's HTTPS only with HSTS, and current browsers no longer offer TLS below 1.2, so a
    downgrade needs an outdated client. Production's asset host is on the custom domain, at TLS 1.2.
- **Alternatives considered**:
  - A separate registrable domain: the same isolation for about $15 a year, and a domain to keep.
  - Each demo in its own Amplify Hosting app on `*.amplifyapp.com` (also a public suffix, so
    per-demo sites): static Amplify apps have no server-side access control beyond a shared
    password, so the demo would be public to anyone with the URL, and the app's tokens would have
    to be handed to the demo origin, where template code could read them. Also 25 apps per region
    by default.
  - One distribution per demo: per-demo sites with server-side checks, but ingest would create
    CloudFront resources per item (minutes each, a quota of about 200), against the automation
    rule.
  - A CSP `sandbox` header on demos: doesn't remove the shared site, and would likely stop the
    demo's own files from loading, because a sandboxed page's requests count as cross-site.

## R21. The user pool in a separate AWS account

- **Decision** (2026-11-08, owner's choice):
  - Two AWS accounts:
    - The **auth account** (the organization's) holds the user pools, the Google provider, the app
      clients, the Cognito domains and the pre-sign-up trigger. `infra/auth` deploys them, a plain
      CDK app like `infra/edge-cert`.
    - The **app account** (the owner's) holds everything else: Amplify Hosting, AppSync, DynamoDB,
      S3, CloudFront and the session function.
  - Two pools, each in its own stack, `ContentForgeAuth-<env>`:
    - `dev` redirects only to `http://localhost:3000` and serves every personal sandbox.
    - `prod` redirects only to the app origin and serves `master`. Its pool is retained and
      deletion-protected, because replacing it would delete every user.
  - **Handover.** `scripts/auth/deploy.sh` deploys a pool and writes its region, IDs, domain and
    redirect origin, as JSON, to the SSM String `/content-forge/auth/<dev|prod>` in the app account
    (R22). The app's backend reads it at synth (`amplify/auth-environment.ts`). Synth stops if it's
    missing or malformed, or if its origin isn't the one this deployment serves.
  - **AppSync** uses OIDC mode with the pool as issuer. Amplify's client sends the Cognito access
    token in that mode, as it does in user-pool mode.
    - There's no client ID check. Each pool has exactly one app client, and the stack test keeps
      it that way.
    - Tokens are refused more than an hour after issue, or more than 7 days and an hour after the
      sign-in they come from. That's the access-token and refresh-token lifetimes again, as a
      second check.
  - **The session function** verifies ID tokens against the pool and client from the handover. The verifier only needs the pool's public keys, so it works across accounts.
  - **`amplify_outputs.json`** gets the same `auth` section Amplify writes for its own pool, through
    `backend.addOutput`, so the front end is unchanged.
  - **The Google client ID and secret** are in Secrets Manager in the auth account
    (`content-forge/google-oauth-client`, set by `scripts/auth/set-google-secret.sh`).
    CloudFormation reads them when it deploys the provider, so they never appear in a template.
- **Rationale**:
  - The owner wants the user records in the organization's account. Where the pool lives doesn't change
    who can sign in: Google's Internal consent screen, the `hd` mapping, the pre-sign-up trigger
    and the session function enforce that.
  - Amplify's `referenceAuth` can't reach another account. Its deploy-time custom resource calls
    `DescribeUserPool` with the app account's credentials, builds ARNs in its own account, and needs
    an identity pool there too.
  - Amplify Data's user-pool mode needs an `auth` resource in the same backend. OIDC mode only needs
    the issuer, and Cognito publishes its discovery document and keys publicly.
  - A plain CDK app, not a second Amplify backend: one stack per environment needs no Hosting app.
  - Secrets Manager costs $0.40 a month, but CloudFormation's free `ssm-secure` references only work
    in a short list of properties, and Cognito's provider details aren't on it.
  - One `dev` pool for all sandboxes, not one each: every sandbox redirects to the same localhost
    origin, and a pool per developer would need a deploy in the auth account for each.
- **Consequences**:
  - Two deploys with two AWS profiles. A pool change means deploying `infra/auth`, then the app if
    the handover changed.
  - Sandboxes share the `dev` pool's users.
  - Offboarding (quickstart §8) runs against the auth account.
- **Still to verify on a sandbox**:
  - that AppSync's OIDC mode accepts the pool's access tokens, including refreshed ones (T130);
  - that a refreshed access token keeps the original `auth_time`. If it doesn't, the 7-day limit
    above simply never triggers;
  - quickstart V2 and V3 again, against the `dev` pool.
  - Fallback if OIDC mode refuses the tokens: AppSync's own Cognito mode, which AWS supports for a
    pool in another account through the API and CloudFormation (not the console), set on the API
    with a CDK override.
- **Alternatives considered**:
  - Everything in the app account, the pool included: one deploy and no handover, but the user
    records would leave the organization's account. The owner declined.
  - A Cognito identity pool in the app account federating the auth account's user pool: that's for
    AWS credentials, which the app never uses.

## R22. Deployment settings stay out of the repo

- **Decision** (2026-11-08):
  - This repo is public and meant to be reusable, so it holds code, scripts and placeholders only.
    Anything that identifies one deployment stays in that deployment's own accounts:
    - the pool handover, SSM `/content-forge/auth/<dev|prod>` in the app account (R21);
    - each environment's CloudFront public key, SSM `/content-forge/<env>/cloudfront/public-key`
      (R8);
    - domains, the allowed email domain, the certificate and zone IDs, and the budget email, as
      Amplify environment variables (quickstart §2), with `example.com` placeholders in the code;
    - account IDs and AWS profile names, which no file names: every script takes `--profile`.
  - Synth reads the SSM values with the deploying credentials (`amplify/parameters.ts`). The
    synthesized templates hold them, but templates stay in `cdk.out` (ignored) and the deploying
    account. Tests point `CONTENT_FORGE_PARAMETERS_DIR` at a directory of stand-in values instead.
  - `docs/deployment/settings.md` lists every setting a deployment provides, and where it lives.
- **Rationale**:
  - None of these values are secret: the front end's bundle ships the pool IDs and domain. But
    committed, they'd tie the repo to one deployment, and anyone reusing it would inherit them.
  - Read at synth, not resolved by CloudFormation at deploy: synth can still check that the pool
    redirects to the origin this deployment serves, and Amplify's outputs (`amplify_outputs.json`)
    get plain values.
- **Rejected**:
  - A private deployment repo: another place to keep in step, for values that already live in the
    accounts that use them. It's still an option for versioning the settings, as long as it only
    feeds SSM and the Amplify app.
  - Environment variables for the handover: every sandbox run would need them set by hand.
- **Consequences**:
  - Synth needs AWS credentials for the app account, which `ampx sandbox` and Amplify Hosting
    already have. The Amplify service role needs `ssm:GetParameter` on `/content-forge/*`
    (quickstart §2).
