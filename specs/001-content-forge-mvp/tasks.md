---

description: "Task list for Content Forge MVP implementation"
---

# Tasks: Content Forge MVP

**Input**: Design documents from `/specs/001-content-forge-mvp/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **Included.** Constitution Principle V (Tested Increments) requires automated tests with
every user story, and unit tests for security rejection paths. Within each story, test tasks come
first and should fail until their implementation tasks land.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on
its own. All four P1 stories are equal in priority. Their phases are ordered **US1 → US4 → US2 →
US3** because the plan builds ingest (US4) before browse and detail, so those can run against real
data. Each story stays testable on its own through the mocked-backend E2E harness (T041–T043).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US7, from spec.md)
- **(owner)**: Needs the project owner's accounts or files (Google Workspace admin, AWS console,
  licensed fonts/logo)

## Path Conventions

The repo is a single package. The web app lives in `src/`, the Amplify Gen 2 backend in `amplify/`,
the us-east-1 certificate app in `infra/edge-cert/`, the ingest CLI in `tools/ingest/`, and tests in
`tests/{unit,component,e2e,smoke,infra,fixtures}/`. See [plan.md](./plan.md#source-code-repository-root).

**Before writing any Next.js code**, read the relevant guide in `node_modules/next/dist/docs/`
(`AGENTS.md`, Principle III).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tooling, dependencies, and configuration everything else builds on

- [ ] T001 Update `package.json`:
  - set `"engines": { "node": ">=24" }`;
  - add scripts:
    - `typecheck`: `tsc --noEmit && tsc --noEmit -p amplify/tsconfig.json && tsc --noEmit -p
      infra/edge-cert/tsconfig.json`, so the backend and CDK code are checked too;
    - `test` (`vitest run`), `test:watch` (`vitest`);
    - `test:e2e`: `playwright test --project=e2e --project=e2e-firefox --project=e2e-webkit`;
    - `test:smoke` (`playwright test --project=smoke`);
    - `test:infra` (`vitest run -c vitest.infra.config.ts`);
    - `test:ingest-e2e` (`vitest run -c vitest.ingest-e2e.config.ts`);
    - `ingest` (`tsx tools/ingest/cli.ts`);
  - create `.nvmrc` containing `24`.
- [ ] T002 Install dependencies, updating `package.json` and `package-lock.json`:
  - **runtime**: `aws-amplify`, `react-aria-components`;
  - **backend dev**: `@aws-amplify/backend`, `@aws-amplify/backend-cli`, `aws-cdk-lib`, `constructs`,
    `aws-jwt-verify`, `@aws-sdk/cloudfront-signer`, `@aws-sdk/client-dynamodb`,
    `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/client-ssm`,
    `@aws-sdk/client-sts`, `@types/aws-lambda`;
  - **ingest dev**: `tsx`, `yauzl`, `@types/yauzl`, `sharp`;
  - **test dev**: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`,
    `@testing-library/user-event`, `@testing-library/jest-dom`, `aws-sdk-client-mock`,
    `@playwright/test`, `@axe-core/playwright`.

  Run `npx playwright install chromium firefox webkit`. Every dependency here is justified in
  plan.md Complexity Tracking (Principle VI).
- [ ] T003 [P] Rewrite `next.config.ts` per research R1:
  - add `output: 'export'`, `trailingSlash: true`,
    `images: { loader: 'custom', loaderFile: './src/lib/assets/image-loader.ts' }`;
  - **remove** `cacheComponents` and `partialPrefetching`;
  - keep `reactCompiler: true` and the existing `turbopack.rules` for `@tailwindcss/turbopack`.

  Read `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` first.
- [ ] T004 [P] Update `tsconfig.json`:
  - confirm `strict: true`;
  - add `"@/*": ["./src/*"]` if missing;
  - set `include` to cover `src`, `tools`, `tests`, `*.config.ts`;
  - set `exclude` to `node_modules`, `out`, `amplify`, `infra`, `.amplify`, `cdk.out`. Those
    folders have their own `tsconfig.json` files, which the `typecheck` script also runs (T001).
- [ ] T005 [P] Create `amplify/package.json` (`{ "type": "module" }`) and `amplify/tsconfig.json`
  (strict, `module`/`moduleResolution` `bundler`), following the Amplify Gen 2 project convention.
  Set `paths: { "$amplify/*": ["../.amplify/generated/*", "../tests/setup/amplify-generated/*"] }`.
  The second location holds committed stubs, so type-checking works in a fresh CI checkout where
  `.amplify/generated` doesn't exist yet:
  - `tests/setup/amplify-generated/env/pre-sign-up.ts` and `.../env/get-download-url.ts`, each
    exporting `env` typed with that function's variables and read from `process.env`.
- [ ] T006 [P] Create the Vitest config:
  - `vitest.config.ts`: jsdom environment, `@vitejs/plugin-react`, `@/` alias, include
    `tests/unit/**` and `tests/component/**`, setup file `tests/setup/vitest.setup.ts`, which imports
    `@testing-library/jest-dom/vitest`;
  - in both configs, alias `/^\$amplify\/(.*)$/` to `tests/setup/amplify-generated/$1` (T005), so
    unit tests can import Amplify function handlers without a sandbox;
  - `vitest.infra.config.ts`: node environment, include `tests/infra/**`;
  - `vitest.ingest-e2e.config.ts`: node environment, include `tests/e2e-ingest/**`, `testTimeout`
    300 s, no file parallelism.
- [ ] T007 [P] Create `playwright.config.ts`:
  - project `e2e`: `testDir: tests/e2e`, Chromium. The config's `webServer` runs
    `node scripts/serve-out.mjs` on port 4173;
  - projects `e2e-firefox` and `e2e-webkit`: same `testDir`, Firefox and WebKit devices, with
    `testMatch` limited to the P1 specs (`us1-*`, `us2-*`, `us3-*`) (FR-042);
  - project `smoke`: `testDir: tests/smoke`, `baseURL` from `SMOKE_BASE_URL`, `storageState`
    `tests/smoke/.auth/state.json`.

  Also create `scripts/serve-out.mjs`, a `node:http` static server for `out/` that resolves
  `dir/` → `dir/index.html` and falls back to `404.html` with status 404.
- [ ] T008 [P] Update `eslint.config.mjs` to ignore `out/`, `.amplify/`, `**/cdk.out/`,
  `amplify_outputs*.json`, `playwright-report/`, `test-results/`, and to set `react/no-danger` to
  `error` (the CSP allows inline scripts, research R18).
- [ ] T009 [P] Create `.github/workflows/ci.yml`:
  - trigger on pull requests and pushes to `master` and `0*-*` branches;
  - Node 24 with `npm ci`;
  - steps: `node scripts/ci/use-e2e-outputs.mjs` → `npm run lint` → `npm run typecheck` →
    `npm test` → `npm run build` → `npx playwright install --with-deps chromium firefox webkit` →
    `npm run test:e2e` → `npm run test:infra`;
  - upload the Playwright report on failure.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The backend skeleton, asset plane, session handling, design tokens, and test harnesses
that every story needs

**⚠️ CRITICAL**: No user story work can start until this phase is complete.

### Bootstrap & edge infrastructure

- [ ] T010 [P] Create the standalone CDK app `infra/edge-cert/`:
  - files: `package.json` (`aws-cdk-lib`, `constructs`, `aws-cdk`), `cdk.json`, `tsconfig.json`
    (strict, checked by the root `typecheck` script), `bin/edge-cert.ts`
    (`env.region = 'us-east-1'`), and `lib/edge-cert-stack.ts`;
  - the stack: an ACM `Certificate` for `assets.example.com`, DNS-validated against
    `HostedZone.fromHostedZoneAttributes` using context `hostedZoneId`, with `CfnOutput`
    `AssetsCertArn` (research R10).
- [ ] T011 [P] Write CDK assertion tests for `infra/edge-cert` in `tests/infra/edge-cert.test.ts`:
  the cert's domain is `assets.example.com`, it uses DNS validation, the stack region is
  `us-east-1`, and the output `AssetsCertArn` exists.
- [ ] T012 [P] Create `scripts/bootstrap/create-signing-keys.sh` (`--env <name> --profile <p>
  [--rotate]`). `<name>` is `master` or `sandbox-<username>` (research R19). The script:
  1. generates an RSA-2048 key pair with `openssl`;
  2. writes the private key with `aws ssm put-parameter --type SecureString` to
     `/content-forge/<env>/cloudfront/private-key`. It refuses to overwrite unless `--rotate` is
     given.
  3. writes the public key to `amplify/custom/assets-cdn/keys/<env>.public-key.pem`, to be
     committed;
  4. deletes every temporary private-key file. Use `trap` cleanup and never write under the repo
     (research R8).
- [ ] T013 [P] Create `src/lib/content-types.ts`. It exports the `CONTENT_TYPES` ordered array:
  `WEBSITE_TEMPLATE`, `POWERPOINT_TEMPLATE`, `VIDEO`, `IMAGE`, `TEXTURE`, `OTHER`. Each entry has:
  - `label` (e.g., "Website Templates");
  - `routeSlug` (`website-templates`, `powerpoint-templates`, `video`, `images`, `textures`,
    `other`);
  - `rowId`.

  Also export helpers `typeFromRouteSlug()` and `labelFor()`, and the `ContentType` and
  `LicenseType` TypeScript unions ([data-model.md](./data-model.md#enum-contenttype)).

### Backend: auth, data, asset plane

- [ ] T014 Create `amplify/auth/pre-sign-up/resource.ts` (`defineFunction({ name: 'pre-sign-up',
  runtime: 24, logging: { retention: '2 weeks' }, environment: { ALLOW_DOMAIN: 'example.com' } })`)
  and
  `amplify/auth/pre-sign-up/handler.ts`. The handler:
  - lower-cases `event.request.userAttributes.email`;
  - throws `Error('ONLY_ALLOWED_DOMAIN')` unless the email ends exactly with `@example.com`;
  - applies to every `triggerSource`, including `PreSignUp_ExternalProvider` (research R3,
    FR-001/002).
- [ ] T015 [P] Write unit tests in `tests/unit/auth/pre-sign-up.test.ts`. Cover:
  - `user@example.com` accepted;
  - `USER@Example.com` accepted;
  - `user@gmail.com` rejected;
  - `user@example.com.evil.com` rejected;
  - `user@sub.example.com` rejected;
  - missing email rejected;
  - `PreSignUp_ExternalProvider` and `PreSignUp_AdminCreateUser` sources.
- [ ] T016 Create `amplify/auth/resource.ts` with `defineAuth`:
  - `loginWith.email: true` (required by Amplify; no password UI is exposed);
  - `externalProviders.google` with `clientId: secret('GOOGLE_CLIENT_ID')`,
    `clientSecret: secret('GOOGLE_CLIENT_SECRET')`, scopes `openid email profile`, and
    `attributeMapping` for `email`, `fullname`/`name`, `profilePicture`/`picture`;
  - `callbackUrls`: `https://content.example.com/auth/callback/` and
    `http://localhost:3000/auth/callback/`;
  - `logoutUrls`: `https://content.example.com/` and `http://localhost:3000/`;
  - `triggers: { preSignUp }`.
- [ ] T017 [P] Create `amplify/data/resource.ts` with the `Content` model exactly as in
  [data-model.md](./data-model.md#entity-content):
  - enums `ContentType`, `ContentStatus`, `LicenseType`;
  - `archiveBytes` as `a.float()`, and `thumbKeys`/`meta` as `a.json()`;
  - secondary indexes `index('slug').queryField('listContentBySlug')` and
    `index('type').sortKeys(['publishedAt']).queryField('listContentByTypeAndPublishedAt')`;
  - `.authorization(allow => [allow.authenticated().to(['read'])])`;
  - `.disableOperations(['mutations', 'subscriptions', 'queries'])`, so the default
    `getContent`/`listContents` queries, which would return drafts, aren't generated;
  - `defineData` with `defaultAuthorizationMode: 'userPool'`.

  **Verify R4** with `npx ampx sandbox`:
  - Do the two index queries still exist after `disableOperations(['queries'])`? If not, disable
    only `mutations` and `subscriptions`, and add to spec.md Assumptions that drafts are readable
    by signed-in users through the API.
  - Does the `type` enum work as an index partition key? If not, make it `a.string()`, validated
    against `CONTENT_TYPES` by ingest.

  Record both outcomes in `specs/001-content-forge-mvp/research.md` (R4).

  Export `type Schema`. Don't add `getDownloadUrl` yet; that's T094.
- [ ] T018 Create `amplify/custom/assets-cdn/construct.ts`, part 1. The `AssetsCdn` construct takes
  props `{ envName, isProduction, publicKeyPem, userPoolId, userPoolClientId, allowedOrigins,
  assetsDomain?, certificateArn?, hostedZoneId?, hostedZoneName? }`. The four optional props are
  required when `isProduction`, and the construct throws if they're missing (research R19). It
  creates:
  - the S3 bucket: `BlockPublicAccess.BLOCK_ALL`, SSE-S3, `enforceSSL`, and an Intelligent-Tiering
    lifecycle transition for prefix `a/`;
  - `cloudfront.PublicKey` from `publicKeyPem` and a `KeyGroup`;
  - a `Distribution` with:
    - default behavior returning 403 through a CloudFront Function;
    - `/v/*` → S3 OAC, `trustedKeyGroups`, `CachePolicy.CACHING_OPTIMIZED`, and a response headers
      policy with `X-Content-Type-Options: nosniff`;
    - `/a/*` → S3 OAC, `trustedKeyGroups`, `CachePolicy.CACHING_DISABLED`;
    - TLS 1.2+ and HTTP/2 and 3;
    - **production only**: the domain from `assetsDomain` and the certificate imported by ARN.
      Sandboxes use the distribution's default `*.cloudfront.net` domain;
  - **production only**: a Route 53 `ARecord`/`AaaaRecord` alias;
  - an `ssm.StringParameter` `/content-forge/<env>/assets/domain` holding the asset host
    (`assetsDomain` or `distribution.domainName`). The Lambdas read it at runtime, which avoids a
    distribution ↔ session-function dependency cycle.

  Follow [contracts/assets-cdn.md](./contracts/assets-cdn.md) and research R6.
- [ ] T019 Extend `amplify/custom/assets-cdn/construct.ts`, part 2. Add:
  - DynamoDB table `DownloadEvents`: PK `contentId`, SK `downloadedAtEmail`, on-demand billing, PITR
    off;
  - an `ssm.StringParameter` `/content-forge/<env>/cloudfront/key-pair-id` set to the public
    key ID;
  - **production only**: an AWS Budgets `CfnBudget` named `content-forge-monthly`, with a $5 cost
    limit and an 80%/100% email notification to the address in env `BUDGET_ALERT_EMAIL`. The
    budget is account-wide, so sandboxes don't create one;
  - public readonly props `bucket`, `distribution`, `downloadEventsTable`, `assetsBaseUrl`
    (`https://<asset host>`).
- [ ] T020 [P] Create `amplify/custom/assets-cdn/session-handler.ts`, a Lambda function URL handler
  per [contracts/assets-cdn.md](./contracts/assets-cdn.md#get-_session):
  - **`GET /_session`**: validate `Origin` against `ALLOWED_ORIGINS`. Verify `X-Id-Token` with
    `CognitoJwtVerifier` (`tokenUse: 'id'`). Require an `@example.com` email. Sign cookies with
    `getSignedCookies` (custom policy, resource `https://<asset host>/v/*`, 12 h). Return `204`
    with three `Set-Cookie` headers and `X-Session-Expires`. Cookie attributes depend on
    `COOKIE_MODE`:
    - `same-site` (production): `Domain=<asset host>; Path=/; Secure; HttpOnly; SameSite=Lax;
      Max-Age=43200`;
    - `cross-site` (sandboxes): no `Domain`, and `SameSite=None` instead of `Lax`.
  - **`GET /_session/signout`**: clear the cookies with `Max-Age=0`.
  - **`OPTIONS` preflight**: `204` with the CORS headers from the contract.
  - **Errors**: `401`/`403`/`500` JSON bodies.
  - **SSM**: read the private key, key-pair ID, and asset host from the parameter names in env and
    cache them per container.
- [ ] T021 Extend `amplify/custom/assets-cdn/construct.ts`, part 3. Add the session Lambda:
  - a `NodejsFunction` for `session-handler.ts`: `Runtime.NODEJS_24_X`, 256 MB, 5 s timeout,
    `reservedConcurrentExecutions: 5`, log group retention 14 days;
  - env `USER_POOL_ID`, `USER_POOL_CLIENT_ID`, `ALLOWED_ORIGINS`, `COOKIE_MODE`,
    `ASSETS_DOMAIN_PARAM`, `PRIVATE_KEY_PARAM`, `KEY_PAIR_ID_PARAM`;
  - `ssm:GetParameter` plus `kms:Decrypt` scoped to the three parameters;
  - `addFunctionUrl({ authType: AWS_IAM })`;
  - distribution behavior `/_session*` → `FunctionUrlOrigin.withOriginAccessControl`, with
    `CACHING_DISABLED` and an origin request policy forwarding headers `X-Id-Token` and `Origin`
    (depends on T018–T020).
- [ ] T022 [P] Write unit tests in `tests/unit/assets/session-handler.test.ts`, mocking the verifier
  and SSM with `aws-sdk-client-mock`. Cover:
  - a valid token gives `204` with exactly three cookies, each with the required attributes;
  - the policy resource is `/v/*` with a 12 h expiry;
  - missing token → `401`, expired or invalid token → `401`;
  - email outside the allowed domain → `403`, disallowed origin → `403`;
  - with `COOKIE_MODE=cross-site`, the cookies have no `Domain` and use `SameSite=None; Secure`;
  - signout clears all three cookies;
  - preflight returns the CORS headers;
  - the SSM read is cached across invocations.
- [ ] T023 [P] Write CDK assertion tests in `tests/infra/assets-cdn.test.ts` that synthesize
  `AssetsCdn` in an isolated `App`/`Stack`, once with `isProduction: true` and once as a sandbox.
  Generate the `publicKeyPem` at test time with `crypto.generateKeyPairSync`. Assert:
  - the bucket blocks all public access;
  - an OAC exists for S3 and for Lambda;
  - `/v/*` and `/a/*` have `TrustedKeyGroups`, and `/a/*` uses the CachingDisabled policy;
  - there's no `AWS::EC2::NatGateway`, `AWS::EC2::VPC`, or Lambda `VpcConfig`;
  - the function URL `AuthType` is `AWS_IAM`, and reserved concurrency is 5;
  - in production, the budget exists with a $5 limit, and the distribution has the alias and a
    Route 53 record;
  - in sandbox mode, there's no budget, alias, or Route 53 record, and the session function's
    `COOKIE_MODE` is `cross-site`;
  - log retention is 14 days;
  - constructing with `isProduction: true` and no `certificateArn` throws.
- [ ] T024 [P] Write a guard test in `tests/infra/function-logging.test.ts` (Principle I: bounded
  logs). It globs `amplify/**/resource.ts`, and for every file that calls `defineFunction(`,
  asserts the call sets `logging: { retention: '2 weeks' }`. This catches a new function added
  without bounded log retention, which the `AssetsCdn` synth test can't see.
- [ ] T025 Create `amplify/backend.ts`:
  - `defineBackend({ auth, data, preSignUp })`;
  - `envName` is `process.env.AWS_BRANCH` when set, otherwise `sandbox-<os.userInfo().username>`,
    and `isProduction = envName === 'master'` (research R19);
  - read `amplify/custom/assets-cdn/keys/<envName>.public-key.pem`. If it's missing, throw an error
    telling the developer to run `scripts/bootstrap/create-signing-keys.sh --env <envName>`;
  - `backend.createStack('assets')` with `new AssetsCdn(...)`, fed from `backend.auth.resources`,
    the key file, `allowedOrigins` (`https://content.example.com` in production,
    `http://localhost:3000` otherwise), and in production `assetsDomain: 'assets.example.com'`,
    `process.env.ASSETS_CERT_ARN`, and `process.env.HOSTED_ZONE_ID`;
  - a CDK override on the Cognito user pool: `adminCreateUserConfig.allowAdminCreateUserOnly =
    true` (to verify in T054, research R3), and refresh-token validity of 7 days on the app client;
  - `backend.addOutput({ custom: { assetsBaseUrl, assetsBucketName, contentTableName:
    backend.data.resources.tables['Content'].tableName, region } })`, per
    [contracts/data-api.md](./contracts/data-api.md#custom-outputs-amplify_outputsjson--custom).
- [ ] T026 Create `amplify.yml`:
  - `backend.phases.build`: `nvm install 24 && nvm use 24`, `npm ci`,
    `npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID`;
  - `frontend.phases.build`: `npm run build`;
  - `artifacts.baseDirectory: out`;
  - `cache` for `node_modules`;
  - `customHeaders` for pattern `**`: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
    strict-origin-when-cross-origin`, and the `Content-Security-Policy` from research R18,
    verbatim. Next.js static pages need `script-src 'unsafe-inline'`, and React Aria needs
    `style-src 'unsafe-inline'`. Don't drop either.

  Research R2, R18.
- [ ] T027 (owner) Run the one-time bootstrap from [quickstart.md](./quickstart.md#2-one-time-bootstrap-documented-exceptions-to-everything-as-code):
  1. deploy `infra/edge-cert`;
  2. run `scripts/bootstrap/create-signing-keys.sh --env master` and commit
     `keys/master.public-key.pem`;
  3. create the Internal Google OAuth client;
  4. connect the Amplify app in `us-west-2`, set secrets `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
     and env `ASSETS_CERT_ARN`, `HOSTED_ZONE_ID`, `BUDGET_ALERT_EMAIL`, and map
     `content.example.com`.

  Then deploy the skeleton and **verify R2**: does platform `WEB` with `out/` serve correctly, or
  is the "Web" framework override needed? Record the outcome in
  `specs/001-content-forge-mvp/research.md` (R2).

### Front-end foundation

- [ ] T028 [P] Define brand design tokens in `src/app/globals.css` with a Tailwind v4 `@theme`:
  - colors `--color-bg #111111`, `--color-surface #303030`, `--color-surface-2 #222222`,
    `--color-text #E5E5E5`, `--color-muted #AAAAAA`, `--color-primary #F2A524`,
    `--color-secondary #B82471`, `--color-accent #AFFC41`;
  - font variables `--font-heading` and `--font-body`;
  - a base dark background and text color;
  - a global amber `:focus-visible` ring;
  - a `@media (prefers-reduced-motion: reduce)` reset for `scroll-behavior` and transitions.
- [ ] T029 [P] (owner files) Create `src/app/fonts.ts`:
  - **Aeonik**: `next/font/local` pointing at `src/app/fonts/Aeonik-*.woff2`, which the owner
    supplies, as `--font-heading`;
  - **Lato** (400/700): `next/font/google`, as `--font-body`.

  Until the Aeonik files arrive, keep the `localFont` call commented out with a TODO and map
  `--font-heading` to Lato.
- [ ] T030 [P] Create `src/lib/auth/amplify-config.ts`. It exports an idempotent
  `configureAmplify()` that calls `Amplify.configure(outputs)` with
  `import outputs from '@/../amplify_outputs.json'`, and an `assetsBaseUrl()` getter that reads
  `outputs.custom.assetsBaseUrl`.
- [ ] T031 [P] Create `src/lib/data/client.ts`. It exports a lazily created
  `generateClient<Schema>({ authMode: 'userPool' })`, typed from `amplify/data/resource.ts`.
- [ ] T032 [P] Create styled React Aria wrappers in `src/components/ui/`:
  - `button.tsx`, `link.tsx`, `skeleton.tsx`;
  - `banner.tsx`: an inline error with a Retry action;
  - `toast.tsx`: a React Aria toast region plus a `useToast()` helper. Check which Toast exports
    the installed `react-aria-components` has. If only the `UNSTABLE_` names are exported (for
    example `UNSTABLE_ToastRegion`, `UNSTABLE_ToastQueue`), import those here and nowhere else, so
    a later rename touches one file.

  All use the brand tokens and amber focus rings, and none uses magenta for text below large-text
  size.
- [ ] T033 Create `src/app/providers.tsx` (`'use client'`). It calls `configureAmplify()` once and
  wraps children in React Aria `RouterProvider` (`navigate={router.push}` from `next/navigation`
  `useRouter`) and the toast region.
- [ ] T034 Update `src/app/layout.tsx`:
  - `<html lang="en">` with the font variables from `src/app/fonts.ts`;
  - `<body>` wrapped in `Providers`;
  - `metadata` title "Content Forge" and `robots: { index: false }`.
- [ ] T035 Create `src/lib/auth/auth-provider.tsx` and `src/lib/auth/use-session.ts`:
  - `AuthProvider` (client) resolves `fetchAuthSession()` and `fetchUserAttributes()`, and exposes
    `{ status: 'loading'|'signedIn'|'signedOut', user: { email, name, picture }, idToken(),
    signOut() }`;
  - when signed out, it calls `router.replace('/')`;
  - `signOut()` calls `GET <assetsBaseUrl>/_session/signout` (`credentials: 'include'`), then
    Amplify `signOut()`, then navigates to `/`.
- [ ] T036 Create `src/lib/assets/asset-session.tsx`. `AssetSessionProvider`:
  - calls `GET <assetsBaseUrl>/_session` with header `X-Id-Token` and `credentials: 'include'`;
  - renders a full-page skeleton until it gets `204`;
  - stores `X-Session-Expires` and refreshes when less than 60 min remain, checked on window focus
    and every 15 min;
  - exposes `reportAssetError()`, which refreshes once and then sets `needsSignIn`, showing a
    "Session expired, sign in again" banner (FR-029,
    [contracts/assets-cdn.md](./contracts/assets-cdn.md#client-obligations)).
- [ ] T037 [P] Write unit tests in `tests/unit/assets/asset-session.test.tsx`, mocking `fetch` and
  using fake timers. Cover:
  - children are blocked until `204`;
  - a refresh happens when expiry is under 60 min;
  - `reportAssetError()` retries exactly once and then sets `needsSignIn`;
  - a `401` from `/_session` triggers sign-out.
- [ ] T038 [P] Create `src/lib/assets/image-loader.ts` and `src/lib/assets/asset-url.ts`:
  - `assetUrl(key)` returns `<assetsBaseUrl>/<key>`;
  - the default-export `next/image` loader takes `src` as a real thumb key,
    `v/<id>/thumb-320.<hash>.webp` (`thumbKeys['320']`). It replaces the `thumb-(320|640|1280)`
    segment with the nearest of 320/640/1280 that's at least the requested width (or the
    largest), and prefixes `assetsBaseUrl`.

  Ingest uses one hash per import for all of an item's generated files, so keys differ only by
  width (research R13, R14).
- [ ] T039 [P] Write unit tests in `tests/unit/assets/image-loader.test.ts` covering width
  rounding (100→320, 321→640, 2000→1280), swapping the width segment in a real `thumb-320` key, and
  the base-URL prefix.
- [ ] T040 Create `src/app/(app)/layout.tsx` (`'use client'`). It composes `AuthProvider` →
  `AssetSessionProvider` → `<main>{children}</main>`, and renders nothing from the catalog until
  both are ready (contracts/ui-routes.md "Global behavior").

### Test harnesses

- [ ] T041 [P] Create `tests/e2e/fixtures/amplify_outputs.e2e.json`, a valid-shaped Amplify outputs
  file with a fake user pool, AppSync URL `https://e2e.appsync-api.us-west-2.amazonaws.com/graphql`,
  and `custom.assetsBaseUrl: https://assets.e2e.test`. Also create `scripts/ci/use-e2e-outputs.mjs`,
  which copies it to `amplify_outputs.json` only when that file is missing.
- [ ] T042 [P] Create the E2E fixture catalog:
  - `tests/e2e/fixtures/catalog.ts`: two or three published items per `ContentType`, one draft, one
    website template with `demoEntryPath`, one without it but with `externalDemoUrl`, and one item
    whose archive is missing;
  - small placeholder WebP/MP4 files in `tests/e2e/fixtures/assets/`.
- [ ] T043 Create `tests/e2e/fixtures/mock-backend.ts`, a Playwright `test.extend` fixture
  (depends on T041, T042). It provides:
  - `signedIn`: seeds `localStorage` with fake unsigned Cognito JWTs with a future `exp`, using
    Amplify's `CognitoIdentityServiceProvider.<clientId>.*` keys;
  - `page.route` for the AppSync URL, dispatching by GraphQL operation name
    (`listContentByTypeAndPublishedAt`, `listContentBySlug`, `getDownloadUrl`) to the fixture
    catalog with the `errorType` behaviors from
    [contracts/data-api.md](./contracts/data-api.md);
  - `page.route` for `https://assets.e2e.test/_session*` → `204`, and for asset paths → fixture
    files;
  - a request log so tests can assert that no catalog or asset requests happened.
- [ ] T044 [P] Create `tests/e2e/helpers/axe.ts`. It exports
  `expectNoA11yViolations(page, context?)`, which uses `@axe-core/playwright` with WCAG 2.1 AA tags
  and fails on any violation (SC-007).

**Checkpoint**: The backend skeleton is deployed, the asset plane passes its infra and unit tests,
providers and test harnesses exist, and user story work can start.

---

## Phase 3: User Story 1 - Sign in with an allowed account (Priority: P1) 🎯 MVP

**Goal**: A public landing page plus Google Workspace sign-in limited to `@example.com`.
Signed-in users reach the browse page. Everyone else is refused, and nothing in the catalog is
reachable without signing in.

**Independent Test**: With an empty catalog, an allowed account reaches `/browse/`. A personal Gmail
account is rejected with "authorized accounts only". Direct requests for catalog pages or assets
without a session are denied (quickstart V1–V4, V12).

### Tests for User Story 1

- [ ] T045 [P] [US1] Write Playwright E2E tests in `tests/e2e/us1-access.spec.ts` using
  `mock-backend.ts`. Cover:
  - `/` shows the sign-in button and makes **no** AppSync or asset requests;
  - clicking "Sign in with Google" navigates to the Cognito `/oauth2/authorize` URL with
    `identity_provider=Google`;
  - `/?error=domain` shows "authorized accounts only";
  - a signed-in user visiting `/` is redirected to `/browse/`;
  - a signed-out user visiting `/browse/` is redirected to `/`;
  - sign-out calls `/_session/signout` and lands on `/`;
  - `expectNoA11yViolations` passes on `/`.
- [ ] T046 [P] [US1] Write component tests in `tests/component/landing.test.tsx`: error query values
  `domain`/`signin` map to the right messages, and the sign-in button is keyboard-operable.

### Implementation for User Story 1

- [ ] T047 [US1] Implement the landing page in `src/app/page.tsx`:
  - logo from `public/brand/logo-white.svg` (owner supplies the file), a one-line description, and
    a React Aria `Button` "Sign in with Google" that calls `signInWithRedirect({ provider: 'Google' })`;
  - the error banner reads `?error=` through `useSearchParams` inside `<Suspense>`;
  - an existing session triggers `router.replace('/browse/')`;
  - no catalog data is fetched (FR-002–FR-004).
- [ ] T048 [P] [US1] Implement `src/app/auth/callback/page.tsx` (client):
  - listen to the Amplify `Hub` `auth` channel (`signInWithRedirect`,
    `signInWithRedirect_failure`) and parse `error_description` from the URL;
  - on success, `router.replace('/browse/')`;
  - on an error containing `ONLY_ALLOWED_DOMAIN` or `PreSignUp`, go to `/?error=domain`; on any
    other error, `/?error=signin`;
  - show a skeleton while waiting.
- [ ] T049 [P] [US1] Implement `src/components/app-header.tsx`: the wordmark linking to `/browse/`,
  the signed-in user's name and avatar (`picture`, falling back to initials), and a "Sign out"
  button calling `useSession().signOut()` (FR-006, FR-014). Render the avatar with `next/image`
  and `unoptimized`, because it's a Google URL and the catalog image loader only handles asset keys
  (research R13). The CSP allows `*.googleusercontent.com` (R18).
- [ ] T050 [US1] Add `AppHeader` above `<main>` in `src/app/(app)/layout.tsx`.
- [ ] T051 [P] [US1] Create a placeholder signed-in home in `src/app/(app)/browse/page.tsx` (`h1`
  "Browse"). It gives the redirect a target, and US2 (T088) replaces it.
- [ ] T052 [P] [US1] Implement the branded not-found page in `src/app/not-found.tsx`, which is
  exported as `404.html`, with a link to `/`.
- [ ] T053 [P] [US1] Create the deployed smoke tests:
  - `tests/smoke/auth.setup.ts`: a headed manual Google login that saves storage state to
    `tests/smoke/.auth/state.json`;
  - `tests/smoke/us1-access.smoke.ts`:
    - a signed-in session reaches `/browse/`;
    - an unauthenticated `request.get` on a `/v/` asset URL returns `403`;
    - an unauthenticated POST of a `listContentByTypeAndPublishedAt` query to the AppSync URL is
      rejected with `401` (SC-002);
    - a signed-in POST of a `createContent` mutation is rejected, because the operation doesn't
      exist (FR-040).
- [ ] T054 [US1] (owner) Deploy to `master`, then:
  - **verify R3**: first-time Google sign-in works with `allowAdminCreateUserOnly: true`. If it
    doesn't, remove the override in `amplify/backend.ts`;
  - set the Google OAuth redirect URI to the Cognito domain's `/oauth2/idpresponse`;
  - confirm with `aws logs describe-log-groups` that the log group of every Lambda in the stack has
    `retentionInDays: 14` (Principle I);
  - run quickstart V1–V4 and V12, and record the R3 outcome in
    `specs/001-content-forge-mvp/research.md`.

**Checkpoint**: US1 works on its own. Only allowed accounts get in, and nothing in the catalog is
exposed.

---

## Phase 4: User Story 4 - Add the existing library to the catalog in bulk (Priority: P1)

**Goal**: The owner imports a folder of purchased files in one unattended run. Types are detected,
previews are generated locally, and everything is uploaded and written idempotently, with a report.

**Independent Test**: Run `npm run ingest -- batch tests/fixtures/ingest` on fixtures with one item
of each type, including a nested-zip template and a zipped `.pptx`. Each item appears with the
correct type, thumbnail, and preview. A re-run produces no duplicates (quickstart §4, V11).

### Tests for User Story 4

- [ ] T055 [P] [US4] Create the ingest fixtures in `tests/fixtures/ingest/` with a generator script
  `tests/fixtures/ingest/build-fixtures.mjs`:
  - `nested-template.zip`: an outer zip containing `documentation/` plus an inner
    `main-files.zip` with `html/index.html`, CSS, JS, and an image;
  - `deck.zip`: a small committed `.pptx`, `deck.pptx`, with three slides;
  - `clip.mp4`: 3 s, from ffmpeg `testsrc`;
  - `photo.jpg`;
  - `textures/stone.png`;
  - `misc.zip`: a PDF and a TXT;
  - malicious archives `bad-traversal.zip` (`../evil.txt`) and `bad-absolute.zip` (`/etc/x`);
  - `wordpress-theme.zip`: `style.css` with a `Theme Name:` header.
- [ ] T056 [P] [US4] Write unit tests in `tests/unit/ingest/sanitize.test.ts` that reject `..`
  segments, absolute paths, drive letters, more than 200k entries, more than 10 GiB uncompressed
  (simulated sizes), and nesting deeper than 3, and that accept normal nested paths (FR-032).
- [ ] T057 [P] [US4] Write unit tests in `tests/unit/ingest/detect.test.ts`:
  - each rule in [contracts/ingest-cli.md](./contracts/ingest-cli.md#detection-rules-first-match-wins-unless-overridden);
  - entry-point preference (`demo`/`html`/`dist`/`template`/`preview`, shallowest first);
  - the largest-deck choice;
  - textures detected by path segment or flag;
  - the WordPress theme and the build-required `package.json` template both give no `demoEntryPath`
    and a warning;
  - overrides win.
- [ ] T058 [P] [US4] Write unit tests in `tests/unit/ingest/metadata.test.ts`. Cover:
  - title cleanup (`Awesome_Template-v2.zip` → "Awesome Template V2");
  - slug generation;
  - CSV parsing with quoted fields, commas, and `;` tags;
  - JSON manifest parsing;
  - precedence: defaults < manifest < sidecar < flags;
  - validation errors (bad enum, non-https URL, bad date) mark the item failed.
- [ ] T059 [P] [US4] Write unit tests in `tests/unit/ingest/pipeline.test.ts`, mocking S3 and
  DynamoDB with `aws-sdk-client-mock` and stubbing the generators. Cover:
  - a new item gets a UUID and `publishedAt`;
  - re-importing an existing slug keeps `id`, `downloadCount`, and `publishedAt`;
  - an unchanged hash is `skipped`;
  - `--force` reprocesses;
  - one failing item doesn't stop the batch;
  - `--dry-run` makes zero AWS calls;
  - old `v/` keys are deleted only after the record is written;
  - `--draft` omits `publishedAt`.
- [ ] T060 [P] [US4] Write unit tests in `tests/unit/ingest/cli.test.ts` covering argument parsing
  for `batch`/`one`/`doctor` and exit codes `0`/`1`/`2`/`3`, per
  [contracts/ingest-cli.md](./contracts/ingest-cli.md#output).
- [ ] T061 [P] [US4] Write the end-to-end ingest test in `tests/e2e-ingest/batch.e2e.test.ts`
  (constitution v1.0.1, Principle V). It runs under `vitest.ingest-e2e.config.ts`:
  - mock S3 and DynamoDB with `aws-sdk-client-mock`, capturing every command and upload body;
  - call the CLI's exported `main(['batch', 'tests/fixtures/ingest', '--outputs',
    'tests/fixtures/ingest/outputs.e2e.json', '--report', <tmp>])`, with **no** generator stubs:
    extraction, detection, Playwright screenshots, LibreOffice/poppler slides, and ffmpeg all run
    for real;
  - assert the exit code is `1`, and that only the two malicious fixtures failed, each with a
    reason in the report;
  - assert, per fixture: the detected type; the `a/<id>/<file>` archive upload with its
    `Content-Disposition`; the expected `v/` keys, all sharing one import hash; that thumbnails
    decode as WebP (`sharp(...).metadata()`); `demo/**` uploads only for the template; and the
    DynamoDB record (`demoEntryPath`, `meta.slideCount === 3`, video `meta.durationSeconds` ≈ 3,
    image dimensions);
  - run it a second time with the first run's state and the mocked `findBySlug` results. Every
    item is `skipped`, and no S3 writes happen (SC-009).

  Commit `tests/fixtures/ingest/outputs.e2e.json` with fake bucket, table, and region values.

### Implementation for User Story 4

- [ ] T062 [P] [US4] Implement `tools/ingest/aws/outputs.ts`. It reads `--outputs` (default
  `./amplify_outputs.json`), validates the `custom.assetsBucketName`, `custom.contentTableName`, and
  `custom.region` keys, and throws a typed `ConfigError` (exit 2). The file is optional when
  `--dry-run` is set.
- [ ] T063 [P] [US4] Implement `tools/ingest/archive/sanitize.ts` with `assertSafeEntry(path)` and
  running totals for size, entry count, and depth, with the limits from the contract.
- [ ] T064 [US4] Implement `tools/ingest/archive/extract.ts` (depends on T063). It streams each
  archive with `yauzl` into `.ingest-tmp/<runId>/<item>/`, recurses into nested `.zip` up to depth 3,
  enforces the sanitize limits per entry, and returns the extracted file tree with sizes.
- [ ] T065 [P] [US4] Implement the detectors in `tools/ingest/detect/`:
  - `type.ts`: rules 1–5;
  - `entry.ts`: picks the demo entry and flags WordPress or build-required packages;
  - `deck.ts`: picks the primary `.ppt`/`.pptx`.
- [ ] T066 [P] [US4] Implement metadata in `tools/ingest/metadata/`:
  - `defaults.ts`: title and slug;
  - `manifest.ts`: a small RFC 4180 CSV parser plus the JSON manifest, matched on `source`;
  - `sidecar.ts`: `<source>.content.json` or `content.json`;
  - `validate.ts`: enum, URL, date, and slug checks returning field errors.
- [ ] T067 [P] [US4] Implement `tools/ingest/generate/image.ts` with `sharp`: write WebP thumbs at
  320/640/1280 and a 2048 preview, all named with the item's import hash, and return
  `{ thumbKeys, previewKeys, meta: { width, height, format } }`. Used for `IMAGE` and `TEXTURE`.
- [ ] T068 [P] [US4] Implement `tools/ingest/generate/video.ts`:
  - `ffprobe` JSON gives the duration, width, height, codec, and fps;
  - the poster comes from `ffmpeg -ss <10%> -frames:v 1` and is resized through `image.ts`;
  - the preview clip uses `-t 30 -vf scale=-2:720 -c:v libx264 -crf 28 -preset veryfast -an
    -movflags +faststart`;
  - it returns `posterKey`, `videoPreviewKey`, `thumbKeys`, and `meta` (research R14).
- [ ] T069 [P] [US4] Implement `tools/ingest/generate/website.ts`:
  - a `node:http` static server over the extracted root;
  - a Playwright Chromium screenshot of `demoEntryPath` at 1440×900 and at 390×844, with
    `waitUntil: 'networkidle'` and a 15 s timeout;
  - a fallback warning when the page fails to load;
  - thumbs come from the desktop shot through `image.ts`, and both shots become `previewKeys`;
  - `meta.pageCount` is the number of HTML files.
- [ ] T070 [P] [US4] Implement `tools/ingest/generate/powerpoint.ts`:
  - copy bundled `.ttf`/`.otf` files into a temporary fontconfig dir (`FONTCONFIG_FILE`);
  - convert with `soffice --headless --convert-to pdf --outdir <tmp> <deck>`;
  - get `slideCount` from `pdfinfo`;
  - render with `pdftoppm -png -r 96 -f 1 -l 12`;
  - pass the images through `sharp` to WebP;
  - slide 1 becomes the thumbs, and slides 1–12 become `previewKeys`;
  - `meta` holds `slideCount`, `deckFileName`, and `aspectRatio`;
  - only the original zip and the previews are uploaded (FR-035).
- [ ] T071 [P] [US4] Implement `tools/ingest/generate/other.ts`. It builds `meta.fileList`
  (`{ path, bytes }`, capped at 500) from the extracted tree. There are no thumbs, so the UI falls
  back to the type icon (FR-023).
- [ ] T072 [P] [US4] Implement `tools/ingest/aws/s3.ts`:
  - `uploadArchive`: multipart with `@aws-sdk/lib-storage` `Upload`, with
    `ContentDisposition: attachment; filename*=UTF-8''<encoded>` and
    `CacheControl: private, no-store`;
  - `uploadViewable`: correct `ContentType` from an extension map (html, css, js, mjs, json, svg,
    png, jpg, webp, gif, woff, woff2, ttf, mp4, webm), with
    `CacheControl: public, max-age=31536000, immutable` for hashed keys and `max-age=3600` for
    `demo/**`;
  - `uploadDemoFolder`: uploads the folder under `v/<id>/demo/`;
  - `deleteKeys`: batch delete.
- [ ] T073 [P] [US4] Implement `tools/ingest/aws/content-table.ts`:
  - `findBySlug(slug)` queries the `bySlug` GSI;
  - `putContent(record, existing?)` writes all [data-model](./data-model.md#entity-content)
    fields plus the Amplify attributes `id`, `__typename: 'Content'`, `createdAt`, `updatedAt`;
  - for an existing item, it keeps `id`, `downloadCount`, and `publishedAt`;
  - for a draft, it omits `publishedAt` entirely (sparse index).
- [ ] T074 [P] [US4] Implement `tools/ingest/report/report.ts`, which writes `ingest-report.json`
  in the [data-model shape](./data-model.md#entity-import-report-local-file) plus a console summary,
  and `tools/ingest/report/state.ts`, which reads and writes `.ingest-state.json` keyed by source
  path with `sha256`, `slug`, `id`, and `completedSteps`.
- [ ] T075 [US4] Implement `tools/ingest/pipeline.ts` (depends on T062–T074). For each item:
  1. hash the source and skip it if unchanged, unless `--force`;
  2. extract;
  3. detect;
  4. merge metadata and validate;
  5. generate previews by type;
  6. if `--dry-run`, stop here and report;
  7. `findBySlug`;
  8. upload `a/`, then `v/` (plus `demo/` for templates);
  9. `putContent`;
  10. delete superseded `v/` keys;
  11. update state;
  12. clean up the temp dir.

  An in-house promise pool runs items with `--concurrency` (default 4, max 8), and every item's
  outcome goes to the report.
- [ ] T076 [US4] Implement `tools/ingest/doctor.ts`. It checks `ffmpeg`, `ffprobe`, `soffice`,
  `pdftoppm`, `pdfinfo`, Playwright Chromium, the outputs file keys, and `sts:GetCallerIdentity`, and
  does a `HeadBucket` and `DescribeTable` with the configured profile. It prints ✔/✖ with install
  hints (`brew install --cask libreoffice`, `brew install poppler`) and runs automatically at the
  start of `batch`/`one`, exiting 3 on failure (FR-039).
- [ ] T077 [US4] Implement `tools/ingest/cli.ts`:
  - `node:util` `parseArgs` for the `batch <dir>`, `one <path>`, and `doctor` commands, with every
    option and per-item override from
    [contracts/ingest-cli.md](./contracts/ingest-cli.md#invocation);
  - AWS clients configured from `--profile` and the outputs `region`;
  - exit codes `0`/`1`/`2`/`3`;
  - export `main(argv: string[]): Promise<number>`, which returns the exit code, and call
    `process.exit(await main(process.argv.slice(2)))` only when the file is run directly. T061
    calls `main` in-process so the SDK mocks apply.
- [ ] T078 [US4] Write `tools/ingest/README.md` covering prerequisites, `doctor`, dry-run, batch and
  one-item usage, manifest/sidecar formats with examples, overrides, resume and `--force`, and
  report interpretation.
- [ ] T079 [US4] Add a CI step to `.github/workflows/ci.yml` that runs
  `npm run ingest -- batch tests/fixtures/ingest --dry-run --report ingest-report.ci.json`. Assert
  the exit code is `1`, because only the malicious fixtures fail, and that the report classifies
  every other fixture correctly, using a small `scripts/ci/check-ingest-report.mjs`.

  Also add an `ingest-e2e` job that runs on pull requests touching `tools/ingest/**`,
  `tests/fixtures/ingest/**`, or `tests/e2e-ingest/**`. It runs `sudo apt-get install -y ffmpeg
  poppler-utils libreoffice-impress`, then `npx playwright install --with-deps chromium`, then
  `npm run test:ingest-e2e` (T061).
- [ ] T080 [US4] (owner) Run [quickstart §4](./quickstart.md#4-load-sample-content) against a
  sandbox or `master`: `doctor`, then a dry run, then a real import of the non-malicious fixtures,
  then a re-run, which should be all `skipped`. Confirm the items exist in DynamoDB and S3 with the
  expected keys (V11).

**Checkpoint**: The catalog can be populated. US4 works on its own through the CLI, its tests, and
its report.

---

## Phase 5: User Story 2 - Browse the catalog by category (Priority: P1)

**Goal**: A signed-in browse page with one horizontally scrolling, keyboard-operable row per content
type that has published items, in the fixed order, with loading and empty states.

**Independent Test**: With the seeded (or mocked) catalog, every published item appears grouped by
type. Rows work with mouse, trackpad, and keyboard alone. Empty types are hidden, and an empty
catalog shows the empty state (quickstart V5).

### Tests for User Story 2

- [ ] T081 [P] [US2] Write component tests in `tests/component/content-card.test.tsx`: thumbnail
  `alt` is "<title> preview", the type badge label is right, the type icon shows when `thumbKeys`
  is empty, and it links to `/content/?slug=<slug>`.
- [ ] T082 [P] [US2] Write component tests in `tests/component/category-row.test.tsx`:
  - the row is one Tab stop;
  - Arrow Left/Right move focus between cards and Enter navigates (`RouterProvider` mock);
  - the scroll buttons have `aria-label="Scroll <Type> left/right"` and are hidden when they can't
    scroll;
  - load-more fetches the next page with `nextToken`;
  - smooth scrolling is off under reduced motion.
- [ ] T083 [P] [US2] Write E2E tests in `tests/e2e/us2-browse.spec.ts` with the mock backend:
  - rows render in `CONTENT_TYPES` order and the draft isn't shown;
  - an empty type row is hidden;
  - an all-empty catalog shows "No content yet.";
  - header type navigation focuses the right row;
  - a failed row shows a retry banner, and retry recovers it;
  - skeletons don't cause layout shift (no CLS above 0.1 using `PerformanceObserver`);
  - `expectNoA11yViolations` passes.

### Implementation for User Story 2

- [ ] T084 [P] [US2] Implement `listRow(type, { limit = 20, nextToken })` in `src/lib/data/content.ts`.
  It calls `client.models.Content.listContentByTypeAndPublishedAt({ type, sortDirection: 'DESC',
  limit, nextToken }, { selectionSet: ['id','slug','title','type','thumbKeys'] })` and returns
  `{ items, nextToken }` ([contracts/data-api.md](./contracts/data-api.md#1-list-a-browse-row)).
- [ ] T085 [US2] Implement `useRow(type)` in `src/lib/data/use-row.ts`, holding
  `{ items, status: 'loading'|'ready'|'error', hasMore, loadMore(), retry() }`. It depends on T084.
- [ ] T086 [P] [US2] Implement `src/components/content-card.tsx` as a React Aria `GridListItem`
  content block:
  - `next/image` with the custom loader, `src={thumbKeys['320']}` (the loader picks the width,
    T038), and a fixed 16:10 aspect box;
  - title, plus a type badge in secondary color at large-text size or as a non-text chip;
  - the type icon fallback;
  - `href` `/content/?slug=<slug>`.
- [ ] T087 [US2] Implement `src/components/category-row.tsx`:
  - an `h2` row title with `id="row-<routeSlug>"`;
  - a React Aria `GridList` with `orientation="horizontal"` and `aria-label=<label>`, whose items
    render `ContentCard`;
  - previous/next `Button`s scroll the container by its client width (smooth unless reduced
    motion);
  - load-more with the collection load-more sentinel.

  **Verify R12** against the installed `react-aria-components`: use `GridListLoadMoreItem` if it's
  exported, otherwise the `onLoadMore` API. Record the API used in
  `specs/001-content-forge-mvp/research.md` (R12).
- [ ] T088 [US2] Replace the placeholder `src/app/(app)/browse/page.tsx` with the real page:
  - an `h1` "Browse";
  - one `useRow` per `CONTENT_TYPES` entry, all fetched in parallel;
  - three skeleton rows while loading;
  - rows with zero items are hidden, and "No content yet." shows when all are empty;
  - a per-row `Banner` with Retry on error (FR-007–FR-012).
- [ ] T089 [US2] Add type navigation to `src/components/app-header.tsx`: a React Aria `Link` list of
  the type labels that scrolls to and focuses `#row-<routeSlug>` on `/browse/`, or navigates to
  `/browse/#row-<routeSlug>` from other pages (FR-010).

**Checkpoint**: US1 and US2 both work. Signed-in users can scan the whole catalog.

---

## Phase 6: User Story 3 - View an item's details and download it (Priority: P1)

**Goal**: A detail page with all of an item's facts and a basic preview, plus a one-click download
of the original file through a 5-minute signed URL. Every download is logged.

**Independent Test**: Open one item's detail page from a card. Its facts and preview show, and
Download saves the original file with its original name within about a second. The download count
goes up by one. Unknown slugs show not-found (quickstart V6, V7).

### Tests for User Story 3

- [ ] T090 [P] [US3] Write unit tests in `tests/unit/functions/get-download-url.test.ts`, mocking
  DynamoDB, S3, and SSM with `aws-sdk-client-mock`. Cover:
  - **errors**: a email outside the allowed domain → `Unauthorized`; a missing item → `NotFound`; a `DRAFT` →
    `NotFound`; `HeadObject` 404 → `ArchiveMissing`;
  - **success**: the URL is signed for `https://<asset host>/<archiveKey>` and `expiresAt` is
    now + 300 s ± 1 s;
  - **logging**: the `DownloadEvents` put has `downloadedAtEmail = <ISO>#<email>`, and the
    `UpdateItem` uses `ADD downloadCount :1`;
  - **logging failure**: when the put or update rejects, the URL is **still returned** and an error
    is logged (FR-020);
  - SSM values are cached.
- [ ] T091 [P] [US3] Write component tests in `tests/component/detail.test.tsx`:
  - `DetailFacts` formats bytes as KB/MB/GB, video duration as `m:ss`, slide count, and image
    dimensions, and shows the source link and license label;
  - `DetailActions` maps each `getDownloadUrl` `errorType` to the right toast message, shows a
    pending state while requesting, and calls `window.location.assign` with the URL.
- [ ] T092 [P] [US3] Write E2E tests in `tests/e2e/us3-detail-download.spec.ts`:
  - clicking a card opens `/content/?slug=…` with title (`h1`), facts, and a preview image;
  - Download leads to navigation to the fixture signed URL;
  - the missing-archive item shows the "file is missing" toast;
  - a missing slug, an unknown slug, and the draft slug all show "We couldn't find that item." with
    a link back;
  - `expectNoA11yViolations` passes.

### Implementation for User Story 3

- [ ] T093 [US3] Create `amplify/functions/get-download-url/resource.ts`
  (`defineFunction({ name: 'get-download-url', runtime: 24, resourceGroupName: 'data', timeoutSeconds: 10,
  logging: { retention: '2 weeks' } })`)
  and `amplify/functions/get-download-url/handler.ts`. The handler implements
  [contracts/data-api.md](./contracts/data-api.md#3-get-a-download-url):
  1. take the email from `event.identity.claims.email` and check the domain;
  2. `GetItem` on Content;
  3. `HeadObject` on the archive;
  4. `Promise.allSettled([PutItem DownloadEvents, UpdateItem ADD downloadCount])`;
  5. sign with `getSignedUrl` (canned policy, 300 s) using the SSM-cached key;
  6. throw errors whose `errorType` names match the contract.
- [ ] T094 [US3] Add to `amplify/data/resource.ts`: `DownloadUrl = a.customType({ url:
  a.url().required(), expiresAt: a.datetime().required() })` and `getDownloadUrl:
  a.query().arguments({ contentId: a.id().required() }).returns(a.ref('DownloadUrl'))
  .authorization(allow => [allow.authenticated()]).handler(a.handler.function(getDownloadUrl))`.
- [ ] T095 [US3] Wire the function in `amplify/backend.ts`:
  - add it to `defineBackend`;
  - `addEnvironment` `CONTENT_TABLE`, `DOWNLOAD_EVENTS_TABLE`, `ASSETS_BUCKET`,
    `ASSETS_DOMAIN_PARAM`, `PRIVATE_KEY_PARAM`, `KEY_PAIR_ID_PARAM`;
  - grant read/write on the Content table, write on `DownloadEvents`, `s3:GetObject` on `a/*` (which
    covers `HeadObject`), and `ssm:GetParameter` + `kms:Decrypt` on the three parameters;
  - use SSM paths rather than stack references where possible, to avoid cross-stack cycles
    (research R9).
- [ ] T096 [P] [US3] Add `getBySlug(slug)` and `requestDownloadUrl(contentId)` to
  `src/lib/data/content.ts`:
  - `getBySlug` uses `listContentBySlug` and returns the first item, or `null` when it's missing
    or not `PUBLISHED`. If there's more than one match, it logs a warning;
  - `requestDownloadUrl` maps GraphQL `errors[].errorType` to a typed error.
- [ ] T097 [P] [US3] Implement `src/components/detail/detail-facts.tsx`: type label, description,
  tags, source marketplace link (`rel="noopener noreferrer"`), license label, original file name,
  formatted size, and the type-specific `meta` facts (FR-015).
- [ ] T098 [P] [US3] Implement `src/components/detail/detail-actions.tsx`: a React Aria `Button`
  "Download" that calls `requestDownloadUrl`, shows a pending state, then
  `window.location.assign(url)`. Errors map to toasts using the messages in
  [contracts/data-api.md](./contracts/data-api.md#3-get-a-download-url). Leave an
  `extraActions` slot for US5.
- [ ] T099 [US3] Implement `src/app/(app)/content/page.tsx`:
  - a client component that reads `slug` with `useSearchParams` inside `<Suspense>` (skeleton
    fallback);
  - loads with `getBySlug`;
  - states: loading skeleton, not-found (missing, no match, or `DRAFT`), and an error `Banner` with
    retry;
  - an `h1` title, a basic preview (the largest thumb through `next/image`, or the type icon),
    `DetailFacts`, and `DetailActions`.

  Follow [contracts/ui-routes.md](./contracts/ui-routes.md#page-states).
- [ ] T100 [US3] Create `tests/smoke/us3-download.smoke.ts`. Against the deployed environment:
  - open a known fixture item and click Download;
  - assert a `download` event with the original filename arrives **within 1 s** of the click,
    measured from the click to the event (SC-005);
  - assert that requesting the archive's `/a/` path with the asset cookies but without the URL
    signature returns `403` (SC-002);
  - assert that replaying the signed URL after expiry returns `403` (marked `test.slow`;
    quickstart V6–V7).

**Checkpoint**: The MVP core works. You can sign in, browse, open an item, and download it
(US1 + US2 + US3, with data from US4).

---

## Phase 7: User Story 5 - Try a website template's live demo (Priority: P2)

**Goal**: Static website templates open as a working live demo in a new tab on the isolated
`assets.` origin. Templates that can't run statically fall back to the vendor's demo link.

**Independent Test**: An imported static template opens with its styles, scripts, and images
working. The demo URL is denied without a session, and demo code can't see app tokens
(quickstart V8, V9).

### Tests for User Story 5

- [ ] T101 [P] [US5] Extend `tests/component/detail.test.tsx` with the action rules table from
  [contracts/ui-routes.md](./contracts/ui-routes.md#detail-page-action-rules):
  - a `WEBSITE_TEMPLATE` with `demoEntryPath` shows Live Demo;
  - no `demoEntryPath` plus an `externalDemoUrl` shows Vendor demo;
  - otherwise neither shows;
  - non-template types never show Live Demo.
- [ ] T102 [P] [US5] Write E2E tests in `tests/e2e/us5-live-demo.spec.ts`: Live Demo opens a popup
  at `https://assets.e2e.test/v/<id>/demo/<entry>` with `noopener`, the vendor demo link has
  `target=_blank` and `rel="noopener noreferrer"`, and the WordPress-type fixture has neither
  button.
- [ ] T103 [P] [US5] Create `tests/smoke/us5-demo.smoke.ts`. Against the deployed environment:
  - open a demo, then assert the page loads with no failed CSS or JS requests;
  - assert `localStorage.length === 0` on the demo origin;
  - assert a context with no cookies gets `403` for the same URL.
- [ ] T104 [US5] Add `demoUrl(item)` to `src/lib/assets/asset-url.ts`. It builds
  `<assetsBaseUrl>/v/<id>/demo/<demoEntryPath>`, encodes each path segment, and refuses paths with
  `..` (FR-034).
- [ ] T105 [US5] Add **Live Demo** and **Vendor demo** to `src/components/detail/detail-actions.tsx`
  following the action rules. Live Demo calls `window.open(demoUrl(item), '_blank', 'noopener')`.
  Vendor demo is an external React Aria `Link` with `target="_blank"` and
  `rel="noopener noreferrer"` (FR-026–FR-028).

**Checkpoint**: Website templates can be evaluated without downloading them.

---

## Phase 8: User Story 6 - Rich type-specific previews (Priority: P2)

**Goal**: Each detail page shows the preview that fits its type: screenshot gallery, slide
gallery, video clip, zoomable image, tiled texture, or file listing.

**Independent Test**: With one item of each type, each detail page renders its type's preview, and
every image has alt text (quickstart V10).

### Tests for User Story 6

- [ ] T106 [P] [US6] Write component tests in `tests/component/previews.test.tsx`:
  - **`PreviewForType`** renders the right component for each `ContentType`;
  - **alt text**: every gallery image has an alt of the form "<title> preview <n>";
  - **video**: `preload="metadata"` with a `poster`, and an `error` event calls
    `reportAssetError()`;
  - **galleries**: the slide gallery caps at 12;
  - **texture**: the tile renders three scales;
  - **file list**: renders paths and sizes;
  - **image zoom**: opens a modal that traps focus and closes on Escape.
- [ ] T107 [P] [US6] Write E2E tests in `tests/e2e/us6-previews.spec.ts` that open the fixture item
  for each type, assert the preview is visible, and run `expectNoA11yViolations` on each.

### Implementation for User Story 6

- [ ] T108 [P] [US6] Implement `src/components/previews/screenshot-gallery.tsx`, with desktop and
  mobile screenshots from `previewKeys` as `next/image`, and labeled tabs ("Desktop" / "Mobile")
  using React Aria `Tabs`.
- [ ] T109 [P] [US6] Implement `src/components/previews/slide-gallery.tsx`, a responsive grid of up
  to 12 slide images showing "Slide n of slideCount", where activating a slide opens it larger in
  the `image-zoom` modal.
- [ ] T110 [P] [US6] Implement `src/components/previews/video-preview.tsx`:
  `<video controls preload="metadata" playsInline poster={assetUrl(posterKey)} src={assetUrl(videoPreviewKey)}>`
  plus a caption with the duration and a note that it's a ≤30 s preview. `onError` calls
  `reportAssetError()`.
- [ ] T111 [P] [US6] Implement `src/components/previews/image-zoom.tsx`, which shows the 2048 preview
  and opens it in a React Aria `Modal`/`Dialog` with an accessible close button. Panning uses
  `overflow: auto`, with no custom gestures.
- [ ] T112 [P] [US6] Implement `src/components/previews/texture-tile.tsx`, which shows three panels
  with `background-image: url(<asset>)`, `background-repeat: repeat`, and `background-size` at
  25%/50%/100%. Each panel has an `aria-label` describing its scale.
- [ ] T113 [P] [US6] Implement `src/components/previews/file-list.tsx`, a table of `meta.fileList`
  with path and formatted size, plus "+N more" when the list was truncated at 500.
- [ ] T114 [US6] Implement `src/components/previews/index.tsx` (`PreviewForType`) mapping each
  `ContentType` to its preview, and replace the basic preview in `src/app/(app)/content/page.tsx`
  with it (FR-024, FR-025).

**Checkpoint**: Users can judge assets visually without downloading them.

---

## Phase 9: User Story 7 - Browsing conveniences (Priority: P3)

**Goal**: A "See all" grid per type and the download count on detail pages.

**Independent Test**: The "See all" page for one type lists every item of that type, and a
download increases the item's displayed count by one.

### Tests for User Story 7

- [ ] T115 [P] [US7] Write E2E tests in `tests/e2e/us7-conveniences.spec.ts`:
  - a row's "See all" link goes to `/browse/<routeSlug>/`, which lists every fixture item of that
    type in a grid and loads more when there are over 60;
  - a type with no items shows "Nothing in <Type> yet.";
  - the detail page shows "Downloaded N times" from the fixture `downloadCount`;
  - `expectNoA11yViolations` passes.

### Implementation for User Story 7

- [ ] T116 [US7] Implement `src/app/(app)/browse/[type]/page.tsx`:
  - `generateStaticParams()` returns every `CONTENT_TYPES[].routeSlug`, and `dynamicParams = false`;
  - a client grid built on React Aria `GridList` (`layout="grid"`) using `useRow(type)` with
    `limit: 60`;
  - an `h1` with the type label, the empty state, and a load-more button.

  Read the static-exports guide's dynamic routes section first (FR-013).
- [ ] T117 [P] [US7] Add a "See all" React Aria `Link` to each row header in
  `src/components/category-row.tsx`, pointing to `/browse/<routeSlug>/` with an accessible name of
  "See all <Type label>".
- [ ] T118 [P] [US7] Show the download count in `src/components/detail/detail-facts.tsx`: "Downloaded
  N time(s)", hidden when N is 0 (FR-021).

**Checkpoint**: Every user story is implemented and works on its own.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, documentation, and validation against the success criteria

- [ ] T119 [P] Update `AGENTS.md`. Keep the generated Next.js block as-is, and add:
  - project commands and the static-export constraints (no route handlers, `proxy.ts`, server
    actions, or default image loader);
  - the Amplify sandbox workflow (`npx ampx sandbox`);
  - ingest prerequisites, the test layers, and the bootstrap steps;
  - a pointer to `.specify/memory/constitution.md` (Principle VI).
- [ ] T120 [P] Rewrite `README.md` with a project overview, the architecture summary from
  [plan.md](./plan.md#summary), and links to the quickstart, spec, and constitution, replacing the
  `create-next-app` boilerplate.
- [ ] T121 [P] Create `tests/e2e/a11y.spec.ts`. It runs `expectNoA11yViolations` on `/`,
  `/browse/`, every `/browse/<type>/`, a `/content/` page for each type, and `404.html`, plus a
  keyboard-only walkthrough (Tab and arrows through the header, rows, and detail actions) asserting
  visible focus (SC-007).
- [ ] T122 [P] Create `scripts/ci/check-bundle.mjs`, which fails if `out/` contains
  `-----BEGIN`, AWS secret-key patterns, `GOOGLE_CLIENT_SECRET`, or `.pem` files, and add it to
  `.github/workflows/ci.yml` after the build (Principle II: no secrets in bundles).
- [ ] T123 Tighten the CSP's `connect-src` in `amplify.yml` to the exact endpoints seen in
  production (the AppSync host, the Cognito domain, `cognito-idp.us-west-2.amazonaws.com`), keeping
  the rest of the research R18 policy, confirm no console CSP
  violations on deployed pages, and record the final policy in
  `specs/001-content-forge-mvp/research.md` (R18).
- [ ] T124 Run Lighthouse (desktop defaults) on deployed `/browse/`. Fix anything that keeps LCP
  above 2.5 s, such as image sizes or row request parallelism. Record the results in
  `specs/001-content-forge-mvp/validation.md` (SC-004).
- [ ] T125 (owner) Run every quickstart validation scenario V1–V14 on the deployed `master` and record
  pass/fail with evidence in `specs/001-content-forge-mvp/validation.md` (SC-001, SC-002, SC-005,
  SC-006, SC-008).
- [ ] T126 (owner) Import the real library with `npm run ingest -- batch "<library>" --manifest
  library.csv` following [quickstart §7](./quickstart.md#7-full-library-import-sc-003). Fix
  detection failures with overrides or heuristic fixes in `tools/ingest/detect/`, re-run until at
  least 95% are `ok` without overrides, and record the rates in
  `specs/001-content-forge-mvp/validation.md` (SC-003, SC-006, SC-009).
- [ ] T127 Confirm the spike outcomes (R2, R3, R4, R12) are recorded in
  `specs/001-content-forge-mvp/research.md`, check every checkbox in this file, and open the PR from
  `001-content-forge-mvp` to `master` linking issue #1, with a per-principle compliance note
  (constitution: Development Workflow).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 → T002 run in order, then T003–T009 run in parallel.
- **Foundational (Phase 2)**: Depends on Setup and **blocks every user story**.
  - The backend chain is T014 → T016 → T017 → T018 → T019 → T021 → T025 → T026 → T027, with T020
    running in parallel with T018/T019.
  - The front-end chain is T030/T031/T032 → T033 → T034 → T035 → T036 → T040.
  - The harness chain is T041/T042 → T043.
- **US1 (Phase 3)**: Depends on Foundational. T054 needs a deploy (T027).
- **US4 (Phase 4)**: Depends on Foundational: T017 for the Content table and T025 for the outputs.
  It's independent of US1's UI.
- **US2 (Phase 5)**: Depends on Foundational. It's testable with the mock backend without US4 data,
  and for real once US4 has populated the catalog.
- **US3 (Phase 6)**: Depends on Foundational. It reuses `src/lib/data/content.ts` from US2 (T084)
  and the header from US1, but its tests run on their own with the mock backend.
- **US5 (Phase 7)**: Depends on US3's `detail-actions.tsx` (T098). Real demos need US4 imports.
- **US6 (Phase 8)**: Depends on US3's detail page (T099). Real previews need US4 imports.
- **US7 (Phase 9)**: Depends on US2 (`useRow`, `category-row.tsx`) and US3 (`detail-facts.tsx`).
- **Polish (Phase 10)**: Depends on every story you want to ship.

### User Story Dependency Graph

```text
Setup ──▶ Foundational ──┬──▶ US1 (access) ────────────────┐
                         ├──▶ US4 (ingest) ──── data ──────┤
                         ├──▶ US2 (browse) ──┬─────────────┤
                         │                   └──▶ US7 ─────┤
                         └──▶ US3 (detail) ──┬──▶ US5 ─────┤
                                             ├──▶ US6 ─────┤
                                             └──▶ US7 ─────┴──▶ Polish
```

### Within Each User Story

- Write the tests first. They should fail until the implementation lands.
- Data/backend before UI: function → schema → backend wiring → client lib → components → page.
- Owner verification tasks (T054, T080) close each story's checkpoint.

### Parallel Opportunities

- **Setup**: T003–T009 (6 tasks) once dependencies are installed.
- **Foundational**:
  - T010–T013, T015, T020, T022, T023, T024 (infra/bootstrap/tests);
  - T028–T032, T037–T039, T041, T042, T044 (front end and harness).
- **US4**: the 7 test tasks (T055–T061), then T062, T063, T065–T074 (12 independent modules)
  before T064/T075–T077.
- **Across stories**: once Foundational is done, US1, US4, US2, and US3 can be worked on in
  parallel. They touch different files, except the shared `src/lib/data/content.ts` (T084 and T096
  are separate functions in one file, so finish T084 first) and `app-header.tsx` (T049 → T089).

---

## Parallel Example: User Story 4

```bash
# Tests (all different files):
Task: "Fixtures in tests/fixtures/ingest/ + build-fixtures.mjs"           # T055
Task: "Unit tests tests/unit/ingest/sanitize.test.ts"                     # T056
Task: "Unit tests tests/unit/ingest/detect.test.ts"                       # T057
Task: "Unit tests tests/unit/ingest/metadata.test.ts"                     # T058
Task: "Unit tests tests/unit/ingest/pipeline.test.ts"                     # T059
Task: "Unit tests tests/unit/ingest/cli.test.ts"                          # T060
Task: "Ingest E2E tests/e2e-ingest/batch.e2e.test.ts"                     # T061

# Independent modules:
Task: "tools/ingest/archive/sanitize.ts"                                  # T063
Task: "tools/ingest/detect/{type,entry,deck}.ts"                          # T065
Task: "tools/ingest/metadata/*"                                           # T066
Task: "tools/ingest/generate/image.ts"                                    # T067
Task: "tools/ingest/generate/video.ts"                                    # T068
Task: "tools/ingest/generate/website.ts"                                  # T069
Task: "tools/ingest/generate/powerpoint.ts"                               # T070
Task: "tools/ingest/aws/s3.ts" and "tools/ingest/aws/content-table.ts"    # T072, T073
```

## Parallel Example: Foundational

```bash
Task: "infra/edge-cert CDK app"                          # T010
Task: "scripts/bootstrap/create-signing-keys.sh"         # T012
Task: "src/lib/content-types.ts"                         # T013
Task: "amplify/custom/assets-cdn/session-handler.ts"     # T020
Task: "src/app/globals.css brand tokens"                 # T028
Task: "src/components/ui/* wrappers"                     # T032
Task: "tests/e2e/fixtures/catalog.ts + assets"           # T042
```

## Parallel Example: User Story 6

```bash
Task: "screenshot-gallery.tsx"   # T108
Task: "slide-gallery.tsx"        # T109
Task: "video-preview.tsx"        # T110
Task: "image-zoom.tsx"           # T111
Task: "texture-tile.tsx"         # T112
Task: "file-list.tsx"            # T113
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup, then Phase 2 Foundational. This includes the owner bootstrap (T027) and the R2
   check.
2. **US1**: deploy and validate sign-in and denial (T054). This is the first safe increment:
   nothing is exposed.
3. **US4**: populate the catalog with fixtures, then real items.
4. **US2 + US3**: browse and download. **STOP and VALIDATE** with quickstart V1–V7 and V11–V12.
   That's the MVP the spec defines (browse, detail, download behind SSO).
5. Demo to the owner, and roll out to staff if ready.

### Incremental Delivery

1. Foundation, then US1: access control is live.
2. US4: the library is loaded.
3. US2 and US3: MVP deliverable.
4. US5: live demos.
5. US6: rich previews.
6. US7: conveniences.
7. Polish: accessibility, performance, security, docs, and full validation.

Each increment keeps every earlier story's tests green, which CI gates (Principle V).

### Parallel Agent Strategy

After Foundational, separate agents can take **US1 (UI)**, **US4 (tools/ingest)**, and
**US2/US3 (src/)**, because their file sets barely overlap. Coordinate the two shared files
(`src/lib/data/content.ts`, `src/components/app-header.tsx`) by finishing the earlier task first.

---

## Notes

- `[P]` = different files with no dependency on an incomplete task. `[USn]` maps to spec.md user
  stories.
- `(owner)` tasks need accounts or licensed files only the owner has. Agents should prepare
  everything around them and then stop.
- Commit after each task or logical group using Conventional Commits, on the
  `001-content-forge-mvp` branch.
- Stop at any checkpoint and validate the story on its own before moving on.
- If a "Verify in spike" outcome (R2, R3, R4, R12) differs from the plan, update `research.md` and any
  affected task before continuing.
