# Implementation Plan: Content Forge MVP

**Branch**: `001-content-forge-mvp` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-content-forge-mvp/spec.md`; technical input from
`docs/requirements/content-forge-mvp.md` (v4)

## Summary

Content Forge is an internal catalog where Entropy Forge employees browse, preview, and download the
company's purchased templates and media.

- **Front end**: a **Next.js 16 static export** (App Router, React Aria Components, Tailwind v4) on
  **Amplify Hosting** at `content.entropy-forge.io`. Pages are static shells, and all data loads on
  the client.
- **Backend (Amplify Gen 2, `us-west-2`)**:
  - **Cognito** with Google federation, restricted to `@entropy-forge.io` by a pre-sign-up trigger;
  - **Amplify Data** (AppSync + DynamoDB) for the read-only catalog, with a `getDownloadUrl` Lambda
    query;
  - a custom CDK **`AssetsCdn`** construct: a private S3 bucket behind CloudFront at
    `assets.entropy-forge.io`.
- **Asset access**: previews and live demos use signed cookies, which a session Lambda issues after
  verifying the Cognito token. Archives use 5-minute signed URLs.
- **Ingest**: a local Node CLI bulk-imports the library. It generates every thumbnail and preview on
  the owner's machine (Playwright, LibreOffice + poppler, ffmpeg, sharp), then writes straight to S3
  and DynamoDB.
- **Cost**: no NAT, VPC, or always-on compute. Estimated at about $1–3/month, almost all S3 storage.

## Technical Context

**Language/Version**: TypeScript 5 (strict) on Node.js 24 LTS: build, Lambda `nodejs24.x`, ingest CLI

**Primary Dependencies**:
- **Web**: Next.js 16.4 (`output: 'export'`), React 19.3 + React Compiler, Tailwind CSS v4,
  `react-aria-components` 1.22, `aws-amplify` 6.x.
- **Backend**: `@aws-amplify/backend` 1.25 / `@aws-amplify/backend-cli`, `aws-cdk-lib`,
  `aws-jwt-verify`, `@aws-sdk/cloudfront-signer`, `@aws-sdk/client-{dynamodb,s3,ssm}`,
  `@aws-sdk/lib-dynamodb`.
- **Ingest**: `@aws-sdk/lib-storage`, `yauzl`, `sharp`, `playwright`, `tsx`, plus system binaries
  `ffmpeg`/`ffprobe`, `soffice`, `pdftoppm`.

**Storage**:
- DynamoDB: Amplify Data `Content` table (with `bySlug` and sparse `byTypeAndPublishedAt` indexes),
  plus the `DownloadEvents` table.
- S3: one private bucket, `a/` for archives and `v/` for viewable assets (see
  [data-model.md](./data-model.md)).

**Testing**: Vitest + jsdom + React Testing Library; `aws-sdk-client-mock`; Playwright (mocked
backend in CI, plus a deployed smoke suite); `@axe-core/playwright`; `aws-cdk-lib/assertions`

**Target Platform**:
- **Browsers**: latest two versions of Chrome, Edge, Firefox, Safari, desktop first and usable at
  tablet width.
- **AWS**: `us-west-2`, with the CloudFront certificate in `us-east-1`.
- **Ingest**: macOS on the owner's machine.

**Project Type**: Web application. A static single-page-style front end plus a serverless backend
defined in the same repo, and a companion CLI tool.

**Performance Goals**:
- Browse first rows < 2.5 s LCP (SC-004).
- Download starts < 1 s, and `getDownloadUrl` p95 < 500 ms (SC-005).
- Bulk import of hundreds of items runs unattended at concurrency 4 (SC-003).

**Constraints**:
- ≤ $5/month excluding storage, with no NAT, VPC, or always-on compute (SC-008, Principle I).
- Static export only (Principle III).
- WCAG 2.1 AA (Principle IV).
- Download URLs ≤ 5 min. Cookie sessions 12 h.
- Ingest safety limits: 10 GiB, 200k entries, nesting depth 3.

**Scale/Scope**:
- Fewer than 50 users. Hundreds of items, about 100 GB. Single-file assets up to several GB.
- 5 user-facing routes plus a not-found page, 6 content types, 3 Lambdas, 1 CLI with 3 commands.
- Environments: production (`master`) plus personal sandboxes with their own asset domain, keys, and
  cookie mode, and no budget (research R19).

All Technical Context items are resolved. There are no `NEEDS CLARIFICATION` markers. Four
research decisions include **Verify in spike** items: R2 (the Amplify platform setting), R3
(federated sign-in with admin-only user creation), R4 (index queries with `disableOperations`, and
an enum as an index key), and R12 (the load-more API name). Each has a decided fallback and doesn't
block the plan.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Pre-research | Post-design |
|---|---|---|---|---|
| I | Cost Discipline | No always-on compute, NAT, or VPC Lambdas. A cost estimate for each billable resource. Budget alert in code. Heavy processing ahead of time. Bounded logs | ✅ | ✅ The R17 estimate puts every item under $1 except S3 storage, which the spec excludes. The budget is in `AssetsCdn` (production only, R19). All three Lambdas set 14-day log retention, checked by tests. All previews are generated locally |
| II | Server-Enforced Access & Isolation | Domain check in the backend. Every read, preview, demo, and download authenticated by the backend/CDN. No data or secrets in bundles. Private storage with OAC. Links ≤ 5 min. Demos on a separate origin. Managed secrets. Archive guards | ✅ | ✅ Pre-sign-up trigger, session Lambda, and download function all check the domain. AppSync uses user-pool auth. CloudFront trusted key groups cover `/v/*` and `/a/*`. The function URL uses OAC + IAM. The private key is in SSM. Demos are on `assets.`. Ingest limits are in the [ingest contract](./contracts/ingest-cli.md) |
| III | Static Front End, Serverless Backend, Everything as Code | `output: 'export'`, App Router only, client calls to the Amplify backend, IaC for everything, bundled Next.js docs read first | ✅ | ✅ Static export (R1). Infrastructure is the `amplify/` backend plus `infra/edge-cert`. Documented bootstrap exceptions: the SSM SecureString, the Google OAuth client, and connecting the Amplify app ([quickstart](./quickstart.md) §2) |
| IV | Accessible by Default | WCAG 2.1 AA, React Aria, axe with 0 violations in CI, contrast, reduced motion, alt text | ✅ | ✅ `GridList` rows (R12), the [UI accessibility contract](./contracts/ui-routes.md#accessibility-contract-principle-iv), axe in E2E (R15) |
| V | Tested Increments | Tests for every story. Unit tests for security rejection paths. CI blocks on failure. Stories independently testable | ✅ | ✅ The R15 matrix covers each layer. A mocked-backend E2E makes every browser story testable in CI, and the ingest E2E runs the real CLI pipeline for US4 (constitution v1.0.1) |
| VI | Simplicity & Agent-Legible Code | YAGNI, strict TypeScript, module boundaries, new dependencies justified, `AGENTS.md` kept current | ✅ | ✅ No state or CLI-framework libraries. Dependencies justified below. `AGENTS.md` update is a planned task |

**Result**: PASS, both before research and after design. The only additions that need justification
are new dependencies (Principle VI), which are listed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-content-forge-mvp/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R17
├── data-model.md        # Phase 1: Content, DownloadEvent, storage layout
├── quickstart.md        # Phase 1: setup + validation scenarios V1–V14
├── contracts/
│   ├── data-api.md      # AppSync operations + custom outputs
│   ├── assets-cdn.md    # CDN behaviors + /_session endpoint
│   ├── ingest-cli.md    # CLI commands, manifest schema, detection, exit codes
│   └── ui-routes.md     # Routes, page states, action rules, a11y contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks; not created by /speckit-plan)
```

### Source Code (repository root)

```text
amplify/                                  # Amplify Gen 2 backend (CDK under the hood)
├── backend.ts                            # defineBackend + AssetsCdn stack + addOutput(custom)
├── auth/
│   ├── resource.ts                       # Google federation, callback/logout URLs
│   └── pre-sign-up/{resource,handler}.ts # @entropy-forge.io domain gate
├── data/resource.ts                      # Content model, indexes, getDownloadUrl query
├── functions/get-download-url/{resource,handler}.ts
├── custom/assets-cdn/
│   ├── construct.ts                      # bucket, CloudFront, key group, DownloadEvents, budget
│   ├── session-handler.ts                # /_session + /_session/signout
│   └── keys/<env>.public-key.pem         # one per environment (master, sandbox-<user>)
├── package.json
└── tsconfig.json

infra/edge-cert/                          # standalone CDK app, us-east-1 ACM cert
├── bin/edge-cert.ts
├── lib/edge-cert-stack.ts
├── cdk.json
└── tsconfig.json

scripts/bootstrap/create-signing-keys.sh  # key pair per environment → SSM + <env>.public-key.pem

src/
├── app/
│   ├── layout.tsx                        # fonts, Providers (RouterProvider)
│   ├── page.tsx                          # landing
│   ├── not-found.tsx
│   ├── fonts/                            # licensed Aeonik WOFF2
│   ├── auth/callback/page.tsx
│   └── (app)/
│       ├── layout.tsx                    # AuthProvider → AssetSessionProvider → AppHeader
│       ├── browse/page.tsx
│       ├── browse/[type]/page.tsx
│       └── content/page.tsx
├── components/
│   ├── app-header.tsx
│   ├── category-row.tsx
│   ├── content-card.tsx
│   ├── detail/{detail-facts,detail-actions}.tsx
│   ├── previews/{screenshot-gallery,slide-gallery,video-preview,image-zoom,texture-tile,file-list}.tsx
│   └── ui/                               # thin styled React Aria wrappers (Button, Link, Toast…)
└── lib/
    ├── auth/{amplify-config,auth-provider,use-session}.ts(x)
    ├── data/{client,content}.ts
    ├── assets/{asset-session,image-loader,asset-url}.ts(x)
    └── content-types.ts                  # enum ↔ label ↔ route slug ↔ row order

tools/ingest/
├── cli.ts                                # parseArgs; batch | one | doctor
├── pipeline.ts                           # per-item steps + promise pool
├── archive/{extract,sanitize}.ts
├── detect/{type,entry,deck}.ts
├── generate/{website,powerpoint,video,image}.ts
├── metadata/{defaults,manifest,sidecar,validate}.ts
├── aws/{outputs,s3,content-table}.ts
└── report/{report,state}.ts

tests/
├── unit/                                 # amplify handlers, lib/*, tools/ingest/*
├── component/                            # RTL
├── e2e/                                  # Playwright (mocked backend) + axe
├── smoke/                                # Playwright vs deployed env (storageState)
├── e2e-ingest/                           # real ingest pipeline on fixtures, AWS SDK mocked
├── infra/                                # CDK assertions + log-retention guard
├── setup/                                # Vitest setup, $amplify/* stubs for CI
└── fixtures/ingest/                      # small sample packages per type

amplify.yml                               # backend deploy, static build (out/), customHeaders, Node 24
```

**Structure Decision**: one repository and one package for the web app, with the Amplify Gen 2
backend in `amplify/` (Amplify's convention), the one-off certificate app in `infra/edge-cert/`,
and the ingest CLI in `tools/ingest/`. This follows the module boundaries in Principle VI. Each
slice can be built and tested in isolation, which suits agent-driven work. All tests live under
`tests/`, split by layer, to match the CI gates.

## Implementation Phasing (input to `/speckit-tasks`)

| Phase | Delivers | Stories / Gates |
|---|---|---|
| 0. Foundation & spike | Static export config (R1). `amplify.yml`. Edge-cert app. Signing-key bootstrap. Empty Amplify backend deployed to `content.` with the R2 platform setting confirmed. CI pipeline. Test harnesses | Constitution gates |
| 1. Access | Auth + pre-sign-up, landing, callback, `(app)` guard, brand tokens/fonts, header, sign-out. Confirm R3 | US1 |
| 2. Asset plane | `AssetsCdn` (bucket, CDN, key group, session Lambda, DownloadEvents, budget). `AssetSessionProvider` | US1 (asset denial), enables US2–US6 |
| 3. Catalog & ingest | `Content` model + indexes. Ingest CLI: extraction, detection, previews for all types, upload, idempotency, report, doctor. Fixtures | US4 |
| 4. Browse | Category rows (R12), cards, image loader, loading/empty states | US2 |
| 5. Detail & download | Detail page, `getDownloadUrl`, toasts, not-found | US3 |
| 6. Demos & previews | Live demo, vendor fallback, type-specific previews | US5, US6 |
| 7. Conveniences | "See all", download count | US7 |
| 8. Hardening | Full axe pass, Lighthouse, smoke suite, `AGENTS.md`, real library import | SC-001–SC-009 |

US4 (ingest) comes before US2 and US3 in build order because they need real data. US2 and US3 can
still be tested on their own against mocked data.

## Complexity Tracking

> Constitution Check passes. The entries below are **new dependencies beyond the approved stack**,
> which Principle VI requires to be justified. None are violations.

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `aws-jwt-verify` | Correct Cognito JWT verification in the session Lambda (JWKS caching, claim checks) | Hand-rolled JWT verification is error-prone, and this is security code (Principle II) |
| `@aws-sdk/cloudfront-signer` | Signed URLs and cookies (FR-018, FR-029) | Hand-rolled RSA-SHA1 policy signing duplicates an official AWS library |
| `@aws-sdk/client-*`, `lib-dynamodb`, `lib-storage` | DynamoDB, S3 multipart, and SSM access from Lambdas and ingest | No alternative. Official SDK |
| `yauzl` | Streaming zip reads with per-entry path control for traversal and zip-bomb guards (FR-032) | `unzipper`/`adm-zip` give less control over entry validation, or load whole archives into memory |
| `sharp` | Image resizing and WebP encoding for every preview | Shelling out to ImageMagick adds a system dependency and is slower |
| `playwright` (dev) | E2E and axe tests, **and** website screenshots in ingest. One dependency covers both | Puppeteer would be a second browser stack |
| `tsx` (dev) | Run the TypeScript ingest CLI without a build step | `tsc` + `node dist/` adds a build artifact for a local tool |
| `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `aws-sdk-client-mock`, `@axe-core/playwright` (dev) | Test layers required by Principle V | No lighter combination covers unit, component, and accessibility testing |
| `@vitejs/plugin-react` (dev) | Lets Vitest compile JSX/TSX for component tests | Vitest has no built-in React transform. Configuring esbuild JSX by hand is the same thing with more setup |
| `@testing-library/jest-dom` (dev) | Accessible DOM matchers (`toBeVisible`, `toHaveAccessibleName`) for component tests | Hand-written assertions on DOM properties are verbose and miss accessibility semantics (Principle IV) |
| `constructs`, `aws-cdk` CLI (dev, `infra/edge-cert`) | `constructs` is the required peer of `aws-cdk-lib`. The CLI deploys the standalone us-east-1 certificate app | No alternative. Amplify's `ampx` only deploys the Amplify backend, not a separate CDK app |
| `infra/edge-cert` standalone CDK app | CloudFront needs a us-east-1 certificate, and Amplify custom stacks are nested in us-west-2 (R10) | Creating it by hand in the console violates Principle III. A cross-region custom resource is more complex |
