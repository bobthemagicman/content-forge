# Plan: Portable deployment (other cloud providers)

**Status**: proposed 2026-11-08, not started. Tasks T131–T146 ([tasks.md](./tasks.md)) are issues
#139–#154.
**Depends on**: the MVP on AWS ([001](../001-content-forge-mvp/plan.md)) and research R22 (no
deployment settings in the repo), which is done.

## Goal

Anyone can deploy their own Content Forge, on AWS or another cloud provider, from this public repo
without editing code and without seeing anyone else's settings. The behavior and security
guarantees are the same everywhere: the spec's requirements, the constitution's Principle II, and
the contracts in [`001/contracts/`](../001-content-forge-mvp/contracts/).

Not goals:

- running one deployment across providers at once, or failing over between them;
- an abstraction for every cloud service: only the handful this app uses, behind small interfaces;
- supporting a provider before someone wants to run on it. Google Cloud is the first candidate
  because it's the closest fit (see [Provider mapping](#provider-mapping)); Azure is planned but
  starts with a spike.

## Where the app is tied to AWS today

| Layer | Today | How tightly |
|---|---|---|
| Web hosting | Amplify Hosting serves the static export; `scripts/hosting/` applies the response headers | Loose: `out/` is plain files, and the header rules are generated from one source |
| Sign-in | Cognito user pool with Google as OIDC provider (infra/auth). The front end uses Amplify Auth (`src/lib/auth/auth-provider.tsx`, `amplify-config.ts`) | Tight in the front end: components get the session through `useSession()`, but the provider imports `aws-amplify/auth` directly |
| Catalog API | AppSync GraphQL (OIDC mode) over DynamoDB, through the Amplify Data client (T084, T096) | Tight: the GraphQL schema and the client are Amplify's |
| Asset delivery | S3 + CloudFront signed cookies (`/v/*`), signed URLs (`/a/*`), a session Lambda (`/_session`), a demo distribution with a CloudFront Function (R6–R8, R20) | The HTTP contract (`contracts/assets-cdn.md`) is neutral; everything behind it is CloudFront-specific |
| Downloads | A resolver Lambda signs a CloudFront URL (data-api §3) | Tight to CloudFront signing |
| Token checks | `aws-jwt-verify` (`CognitoJwtVerifier`) in the session and download functions | Medium: the checks are plain JWT, the library is Cognito's |
| Settings | SSM and Secrets Manager, read at synth and at runtime (R22) | Medium: the settings are listed neutrally in `docs/deployment/settings.md` |
| Build outputs | `amplify_outputs.json`, imported by the front end at build time | Tight: its shape is Amplify's |
| Ingest CLI | Writes S3 objects and DynamoDB items (contracts/ingest-cli.md) | Tight, but not built yet, so cheap to fix now |
| Budget, logs | AWS Budgets, CloudWatch with 14-day retention | Loose: every provider has both |
| Infrastructure code | Amplify Gen 2 + CDK | AWS only, by nature |

The constitution also names AWS: Principle III ("All data access MUST go through the Amplify Gen 2
backend") and the Technology & Platform Constraints. Supporting another provider needs an
amendment first (T131).

## Approach: one app, small ports, one adapter set per provider

Keep a single app and a single set of contracts. Where the app touches a cloud service, it goes
through a small interface (a port). Each provider gets an adapter for each port, and its own
infrastructure code under `deploy/<provider>/`. Nothing else in the app knows which provider it's
on.

### Ports

| Port | Side | Methods (sketch) | AWS adapter |
|---|---|---|---|
| `AuthClient` | Browser | `signIn()`, `signOut()`, `idToken()`, `accessToken()`, session events | Amplify Auth (today), or generic OIDC (T138) |
| `CatalogClient` | Browser | `listRow()`, `getBySlug()`, `requestDownloadUrl()`: the functions `src/lib/data/content.ts` already exports | Amplify Data client (T084, T096) |
| `TokenVerifier` | Server | `verify(token) → claims`, with issuer, audience and allowed domain from settings | `jose` against the pool's JWKS (replaces `aws-jwt-verify`, T136) |
| `CatalogStore` | Server, ingest | `get`, `listPublishedByType`, `put`, `recordDownload` | DynamoDB |
| `ObjectStore` | Ingest | `put`, `head`, `delete` under a prefix | S3 |
| `AssetSigner` | Server | `sessionCookies(policy)`, `downloadUrl(key, ttl)`, `demoLaunch(id)` | CloudFront signer |
| `SettingsStore` | Deploy, server | `get(name)` for the settings in `docs/deployment/settings.md` | SSM, Secrets Manager |

**Status:** the browser ports, `AuthClient` and `CatalogClient`, are in `src/lib/platform/` with
their AWS adapters in `src/lib/platform/aws/` (T134, T135); the table above describes the app
before them.

The browser ports are chosen at build time from a provider-neutral config file,
`platform-config.json` (T132), which each provider's deploy writes. It replaces the front end's
direct import of `amplify_outputs.json`: on AWS a small step converts one into the other, so Amplify
keeps working unchanged.

```json
{
  "provider": "aws",
  "auth": { "kind": "cognito", "issuer": "…", "clientId": "…", "domain": "…", "scopes": ["openid", "email", "profile"], "redirectUri": "…" },
  "catalog": { "kind": "appsync", "url": "…" },
  "assets": { "baseUrl": "https://assets.example.com" }
}
```

An ESLint `no-restricted-imports` rule keeps provider SDKs (`aws-amplify`, `@aws-sdk/*`, and later
`firebase`, `@azure/*`) inside their adapter folders, so the boundary can't erode unnoticed.

### Neutral protocols where they're cheap

Some coupling goes away by using a standard instead of an adapter:

- **Sign-in is OIDC.** Every broker considered (Cognito, Google Identity Platform, Microsoft Entra
  External ID, Keycloak, Auth0) issues JWTs with a public JWKS. The server side only needs
  `TokenVerifier` with an issuer, audience and claim rules. In the browser, a generic OIDC client
  (authorization code + PKCE, for example `oidc-client-ts`) covers every broker except Identity
  Platform, which has its own SDK and gets its own adapter.
- **The catalog API becomes a small HTTP JSON API** for new providers (T139): three operations,
  the ones `src/lib/data/content.ts` exposes, as one Fetch-API handler (`Request → Response`) over
  `CatalogStore`. The same handler runs on Lambda function URLs, Cloud Run and Azure Functions.
  Whether AWS also moves to it, retiring AppSync, is decided when the second provider ships: two
  API implementations is a cost, but AppSync is working and free.
- **Asset access keeps the HTTP contract** in `contracts/assets-cdn.md` (`/_session`, `/v/*`,
  `/a/*`, the demo host). For providers without a CDN that verifies signed cookies cheaply, a
  portable **asset gateway** implements it (T140): a scale-to-zero function that checks an
  HMAC-signed cookie or URL, then streams the object from private storage, with range requests
  for video. No edge caching, which is fine at this app's size (fewer than 50 users).

### Rejected

- **Separate forks or branches per provider**: they drift, and fixes land three times.
- **Our own sign-in service** (the app talks to Google directly, then issues its own session):
  Google's web clients need a client secret to exchange the code, so a server would hold it, mint
  sessions, refresh them and support sign-out everywhere. That's a security-critical service to
  write and maintain, when every provider offers a managed broker.
- **One multi-cloud IaC tool for every provider, AWS included**: rewriting the working Amplify
  backend buys nothing for AWS users and loses `ampx sandbox`.
- **Kubernetes as the portability layer**: always-on compute, against Principle I.

## Provider mapping

| Need | AWS (today) | Google Cloud (first) | Azure (spike first) |
|---|---|---|---|
| Static web hosting + headers | Amplify Hosting | Firebase Hosting (`firebase.json` headers) | Static Web Apps (`staticwebapp.config.json`) |
| Sign-in broker, Google Workspace only | Cognito + Google OIDC, pre-sign-up trigger | Identity Platform + Google provider, blocking function `beforeCreate` | Entra External ID + Google federation, or Google as a custom OIDC provider |
| Catalog API | AppSync (OIDC) | Cloud Run, the shared handler | Azure Functions (Consumption), the shared handler |
| Catalog store | DynamoDB (on demand) | Firestore | Cosmos DB (serverless or free tier) |
| Private object storage | S3, Block Public Access, OAC | Cloud Storage, uniform access, public access prevention | Blob Storage, public access off |
| Protected assets (`/v/*`) | CloudFront signed cookies | Asset gateway on Cloud Run | Asset gateway on Azure Functions |
| Downloads (`/a/*`, ≤ 5 min) | CloudFront signed URL | Cloud Storage V4 signed URL, or the gateway | Blob user-delegation SAS, or the gateway |
| Demo host, a separate site | Demo distribution's `*.cloudfront.net` | A separate Cloud Run service on its own `*.run.app` host | A separate Function app on its own `*.azurewebsites.net` host |
| Secrets and settings | SSM, Secrets Manager | Secret Manager | Key Vault |
| Budget alert | AWS Budgets | Cloud Billing budget | Cost Management budget |
| Logs, 14 days | CloudWatch | Cloud Logging bucket retention | Log Analytics retention |
| Infrastructure code | Amplify Gen 2 + CDK | Chosen in T133 | Chosen in T133 |

Why the asset gateway rather than each provider's CDN:

- Google Cloud CDN does support signed cookies, but it needs an external Application Load
  Balancer, whose forwarding rule costs about $18 a month whether used or not.
- Azure Front Door has no signed cookies or URLs, and its Standard tier has a monthly base fee.
- Both break Principle I's $5 budget. The gateway costs nothing idle. If a deployment outgrows
  it, the CDN version is an adapter swap behind the same contract.

Demo isolation needs the demo host to be a different registrable domain from the app. `run.app`
and `azurewebsites.net` are listed on the Public Suffix List, so each service host is its own
site, as `cloudfront.net` hosts are. T142 and T146 confirm this before relying on it.

## Infrastructure code and settings

- AWS keeps `amplify/` and `infra/` where they are, so nothing moves for AWS users.
- `deploy/gcp/`, `deploy/azure/`: one IaC project each. **Recommendation: Pulumi with TypeScript**:
  the repo's language, unit tests in Vitest with mocked resources (like the CDK assertion tests),
  and the settings types shared with the AWS side. OpenTofu is the alternative, more widely known
  but a second language. T133 records the decision.
- Each provider reads the settings in `docs/deployment/settings.md` from its own secret or settings
  store, and writes `platform-config.json` for the web build. No provider's settings are committed
  (R22).
- One deploy entry point, `scripts/deploy.sh --provider <aws|gcp|azure> --env <env>`, which
  dispatches to the provider's tooling (T144).

## Proving it's the same app everywhere

A **conformance suite** (T141) runs against any deployed environment, given its URLs and a test
account. It extends the smoke tests:

- an allowed Workspace account signs in, and others don't (V3);
- the catalog API refuses calls without a valid token;
- `/v/*` refuses requests without the cookie, `/a/*` refuses expired URLs, and the asset host
  serves no template code;
- the demo host is a separate site, gets no app tokens, and refuses an expired launch link;
- the response headers match R18.

A provider is supported when this suite and quickstart V1–V14 pass on it (T145).

## Constitution check

| Principle | Effect |
|---|---|
| I. Cost | Every new provider needs a cost estimate like R17 before it ships. The gateway keeps fixed costs at zero |
| II. Access and isolation | Unchanged, and checked per provider by the conformance suite. The asset gateway is security-critical code: unit tests for every rejection path |
| III. Static front end, everything as code | **Needs an amendment** (T131): "Amplify Gen 2 backend" becomes "the deployment's backend, through the ports", and IaC is required per provider |
| V. Tested increments | The ports get contract tests that every adapter runs |
| VI. Simplicity | Seven small ports, no plugin framework. Each new dependency (`jose`, `oidc-client-ts`, Pulumi) needs a reason in its task |

## Phases

| Phase | Tasks | Changes behavior? |
|---|---|---|
| 0. Decide and define the contracts | T131 amendment, T132 `platform-config.json`, T133 IaC tool | No |
| 1. Ports in the app, AWS adapters only | T134 `AuthClient`, T135 `CatalogClient` and the import rule, T136 server ports, T137 ingest on ports | No: AWS keeps working the same way, and every test still passes |
| 2. Neutral protocols | T138 generic OIDC client, T139 catalog HTTP API, T140 asset gateway | No on AWS, unless T138 replaces Amplify Auth |
| 3. Conformance suite | T141 | No |
| 4. Google Cloud | T142 spike, T143 IaC, T144 deploy entry point and quickstart, T145 validation | New provider |
| 5. Azure | T146 spike, then its own tasks | New provider |

Phase 1 is worth doing during the MVP, because T084, T096 and the ingest CLI are still to be
written: building them behind the ports now costs little, and retrofitting later costs more.
Phases 2–5 wait until someone wants a second provider.

## Open questions (answered by the spikes)

- Does Identity Platform's Google provider pass Google's `hd` claim through, so the token check can
  keep requiring it? If not, the check relies on the Internal consent screen and the email domain.
- Refresh-token lifetimes and "sign out everywhere" on each broker, for offboarding (quickstart §8).
- Cloud Run and Azure Functions limits for streaming large video previews with range requests.
- Whether the demo launch flow (R20: a launch link that sets cookies on the demo host) maps onto
  the gateway without a CloudFront Function equivalent. The sketch: the demo gateway's own
  `/_launch` path checks the signed link and sets a host-only cookie.
