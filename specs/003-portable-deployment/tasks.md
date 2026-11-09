# Tasks: Portable deployment

Design: [plan.md](./plan.md). Task numbers continue from
[001's tasks](../001-content-forge-mvp/tasks.md). Each task has a GitHub issue titled `TNNN: …`:
T131 is #139, and so on up to T146, #154. `[P]` means it can run in parallel with the other `[P]` tasks in its phase.

## Phase 0: Decide and define the contracts

- [ ] T131 (owner) Amend the constitution for more than one cloud provider (plan "Constitution
  check"). Principle III's "All data access MUST go through the Amplify Gen 2 backend" becomes
  "through the deployment's backend, behind the app's ports", and "everything as code" applies to
  each provider's `deploy/<provider>/`. The Technology & Platform Constraints name AWS as the
  reference provider and list what any other provider must offer: scale-to-zero compute, private
  object storage, a managed OIDC broker that can limit sign-in to one Google Workspace domain, a
  managed secret store, a budget alert, and hosts on a public suffix for demos. Principle I's
  budget applies per deployment. Bump the version, and update `plan.md`'s constitution checks in
  001 and here.
- [x] T132 [P] Define `platform-config.json`, the provider-neutral config the web build reads
  (plan "Ports"), as a TypeScript type with a validator in `src/lib/platform/config.ts`, plus a
  contract page `contracts/platform-config.md` in this folder.
  - On AWS, `scripts/platform/aws-outputs-to-config.mjs` converts `amplify_outputs.json`, and
    `predev`/`prebuild` run it. The E2E fixture gets a `platform-config.json` twin.
  - Tests: the converter on the E2E fixture; the validator refuses a missing issuer, a non-HTTPS
    URL (except `http://localhost`), and an unknown `kind`.
  - **Done.** The contract is [contracts/platform-config.md](./contracts/platform-config.md).
    - `catalog` carries only the GraphQL endpoint and region, not Amplify's model introspection. So
      the AppSync adapter (T084, T096) sends named GraphQL documents with `client.graphql()`
      instead of `client.models`.
    - `pretest` runs the converter too, and the E2E mocks read their endpoints from the twin.
- [ ] T133 [P] Choose the IaC tool for providers other than AWS and record it as a research entry
  in this folder. The plan recommends Pulumi with TypeScript; compare it with OpenTofu on: unit
  testing in Vitest, sharing the settings types, state storage cost (Pulumi Cloud's free tier or a
  bucket backend), and how a new user bootstraps it. AWS stays on Amplify Gen 2 + CDK either way.

## Phase 1: Ports in the app, AWS adapters only (no behavior change)

- [x] T134 [P] Put sign-in behind an `AuthClient` port in `src/lib/platform/auth.ts`: `signIn()`,
  `signOut()`, `idToken()`, `accessToken()`, and a session-change subscription. Move the Amplify
  code from `src/lib/auth/auth-provider.tsx` and `amplify-config.ts` into
  `src/lib/platform/aws/auth.ts`; `AuthProvider` uses only the port, picked from
  `platform-config.json` (T132). The existing component and E2E tests pass unchanged.
  - **Done.** The port also has `currentUser()` and `completeSignIn(onResult)`, so the callback page
    (`src/components/auth/auth-callback.tsx`) uses it too. `completeSignIn` takes a callback rather
    than returning a promise, so the redirect still happens in the same tick as the broker's event.
  - The component tests needed only their module mocks repointed: `@/lib/platform/aws/amplify`
    instead of `@/lib/auth/amplify-config`, `GOOGLE_PROVIDER_NAME` from the adapter, and
    `PLATFORM_CONFIG` in the `@/lib/config` mock. Their cases and assertions are unchanged. The
    E2E tests are unchanged.
- [x] T135 [P] Put catalog reads behind a `CatalogClient` port: the three functions
  `src/lib/data/content.ts` exports, with the demo catalog as one adapter and AppSync (T084, T096)
  as the AWS one in `src/lib/platform/aws/catalog.ts`. Add an ESLint `no-restricted-imports` rule
  that allows `aws-amplify` and `@aws-sdk/*` only under `src/lib/platform/aws/` (and `amplify/`,
  `tools/`), with a test that the rule fires.
  - **Done.** The port is `src/lib/platform/catalog.ts`, the demo adapter
    `src/lib/platform/demo/catalog.ts`. `src/lib/platform/aws/catalog.ts` holds the shared
    GraphQL client until T084 and T096 build the adapter on it; until then every build uses the
    demo catalog, as before.
  - The lint rule also refuses `amplify_outputs.json` and `amplify/` imports in `src/`
    (`tests/unit/lint/provider-imports.test.ts`).
- [x] T136 Put the server-side cloud calls behind ports in a shared `packages/platform/` (or
  `amplify/lib/platform/`): `TokenVerifier`, `CatalogStore`, `AssetSigner`, `SettingsStore`.
  - `TokenVerifier` uses `jose` with the issuer's JWKS, so it works with any OIDC broker. It
    replaces `aws-jwt-verify` in the session and download functions, and keeps every check in
    `contracts/assets-cdn.md` (issuer, audience, `token_use`, expiry, email domain,
    `email_verified`, `hd`).
  - Port contract tests every adapter must pass, starting with the AWS ones.
  - The existing session-handler tests pass unchanged, plus a test that a token from another
    issuer, or with `alg: none`, is refused.
  - **Done.** The ports are in `amplify/lib/platform/ports.ts`:
    - the neutral adapters beside them: `jwt-verifier.ts` (`jose`, RS256 only, `exp` and `iat`
      required), `identity.ts` (the email, `email_verified` and hosted-domain rules, with the claim
      name as a parameter), and `directory-settings.ts` (files, for tests and offline synth);
    - the AWS adapters in `aws/`: SSM, DynamoDB and CloudFront.
  - The session handler uses only the ports, and `amplify/parameters.ts` reads synth settings
    through `SettingsStore`. `CatalogStore` has only `get` so far, and `AssetSigner.downloadUrl`
    is ready for US3. Ingest (T137) and downloads add the other methods when they need them.
  - Contract suites, in `tests/unit/platform/server/contracts/`:
    - `TokenVerifier`: another issuer or audience, expired, no expiry, the wrong `token_use`,
      another key, `alg: none`, an unknown key ID, HS256 keyed with the public key. Run with a
      local key set and a fetched one.
    - `SettingsStore`: SSM, and the directory store.
    - `CatalogStore`: DynamoDB, with projections applied.
    - `AssetSigner`: CloudFront.
  - Key-fetch failures (network, non-200, bad JSON, not a key set) are `KeyFetchError`, so the
    handler still answers `500`, not `401`, during an outage.
  - The session-handler tests keep every case. Only the verifier stub changed: it now stubs
    `createJwtVerifier` and throws the port's errors instead of `aws-jwt-verify`'s. The demo
    projection test expects the adapter's placeholders.
  - ESLint now refuses `@aws-sdk/*` and `aws-jwt-verify` in function handlers and the neutral
    platform code (`tests/unit/lint/server-provider-imports.test.ts`).
- [ ] T137 Build the ingest CLI (001 Phase 4, T055 onward) on `ObjectStore` and `CatalogStore`,
  with S3 and DynamoDB adapters, so the pipeline in `contracts/ingest-cli.md` has no AWS imports
  outside its adapters. If those tasks are already done when this starts, refactor them instead.

## Phase 2: Neutral protocols

- [ ] T138 Evaluate a generic OIDC `AuthClient` adapter (authorization code + PKCE, for example
  `oidc-client-ts`) against Cognito: sign-in, silent refresh, sign-out through Cognito's
  `/logout`, and the E2E suite. If it passes everything Amplify Auth does, make it the AWS
  default and drop `aws-amplify/auth`; otherwise record why not and keep it for other brokers.
- [ ] T139 Specify and build the catalog HTTP API for providers without AppSync.
  - Contract `contracts/catalog-http-api.md`: `GET /catalog/rows/<type>?limit&nextToken`,
    `GET /catalog/items/<slug>`, `POST /catalog/items/<id>/download`. Bearer access token, with the
    same errors and limits as data-api §1–§3.
  - One handler (`Request → Response`) over `CatalogStore` and `TokenVerifier`, with thin wrappers
    for Lambda function URLs, Cloud Run and Azure Functions.
  - A `CatalogClient` adapter for it. Tests: every error row in the contract, pagination, and that
    drafts are never returned.
- [ ] T140 Build the portable asset gateway (plan "Neutral protocols"), implementing
  `contracts/assets-cdn.md` without a CDN.
  - `/_session` sets an HMAC-signed, host-only cookie (`Path=/v/`, 12 hours).
  - `/v/*` checks it and streams from `ObjectStore` with range requests and the object's
    `Cache-Control: private`.
  - `/a/*` accepts only a signed URL that expires within 300 s.
  - A separate demo gateway serves `d/` objects on its own host behind launch links (R20).
  - Security tests for every rejection path: no cookie, wrong signature, expired, a path outside
    the policy, path traversal, and a demo object requested from the asset host.

## Phase 3: Conformance

- [ ] T141 Create the provider conformance suite (plan "Proving it's the same app everywhere") as
  a Playwright project, `--project=conformance`, that takes a deployment's `platform-config.json`
  and a test account's stored session. Run it against the AWS sandbox first.

## Phase 4: Google Cloud

- [ ] T142 Spike on Google Cloud, recorded as research entries in this folder:
  - Identity Platform with the Google provider and the Internal consent screen: does the token
    carry `hd`? Does a `beforeCreate` blocking function enforce the domain? How long do refresh
    tokens last, and how do you revoke a user's sessions?
  - Cloud Run streaming limits for range requests on large previews.
  - That `run.app` hosts are separate sites for the demo gateway (Public Suffix List).
  - A monthly cost estimate like 001's R17, with every line under Principle I's limits.
- [ ] T143 Write `deploy/gcp/` with the tool from T133: Firebase Hosting with the R18 headers,
  Identity Platform, Firestore, Cloud Storage, Cloud Run services for the catalog API, the asset
  gateway and the demo gateway, Secret Manager, a budget alert, and 14-day log retention. IaC unit
  tests like `tests/infra/`.
- [ ] T144 Add `scripts/deploy.sh --provider <aws|gcp> --env <env>` and a Google Cloud quickstart.
  It reads the settings from `docs/deployment/settings.md` from the provider's secret store, never
  from the repo, and writes `platform-config.json` for the web build.
- [ ] T145 (owner) Deploy to Google Cloud and run the conformance suite and quickstart V1–V14
  there. Record pass or fail with evidence in this folder's `validation.md`.

## Phase 5: Azure

- [ ] T146 Spike on Azure, like T142: Entra External ID with Google federation, or Google as a
  custom OIDC provider (Workspace restriction, `hd`, offboarding); Functions streaming limits;
  `azurewebsites.net` as the demo site; a cost estimate. Then add Azure's tasks here.

## Dependencies

- T131 comes before any Phase 4 or 5 work ships. Phases 0 and 1 don't need it, because they don't
  change what's deployed.
- T134 and T135 need T132. T136 and T137 can start any time.
- T139 and T140 need T136. T141 needs T132.
- T143 needs T133, T139, T140 and T142. T144 needs T143. T145 needs T141 and T144.
