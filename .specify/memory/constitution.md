<!--
Sync Impact Report
==================
Version change: 1.0.1 → 1.0.2
Bump rationale: PATCH. The repository's primary branch was renamed from `main` to `master`. The
Development Workflow branch rule now names `master`. No principle or rule changed meaning.

Modified principles: none
Modified sections:
  - Development Workflow & Quality Gates: "Nothing is committed directly to `main`" → `master`

Added sections: none
Removed sections: none

Dependent artifacts (read the constitution at runtime; not modified by this command):
  - .specify/templates/*: no change needed
  - specs/001-content-forge-mvp/*: production environment and branch references updated to
    `master` in the same change

Deferred TODOs: none

History:
  - 1.0.1 (2026-10-27): Principle V defines end-to-end tests for non-UI journeys (ingest CLI).
  - 1.0.0 (2026-10-27): first ratification; principles I–VI, Technology & Platform Constraints,
    Development Workflow & Quality Gates, Governance.
-->

# Content Forge Constitution

## Core Principles

### I. Cost Discipline (Near-Zero Spend)

Content Forge is an internal tool with a budget of zero. Every design choice MUST favor
pay-per-use services that stay within AWS always-free tiers at current usage.

- MUST NOT provision always-on compute (EC2, ECS/Fargate services, provisioned databases), NAT
  Gateways, or VPC-attached Lambdas that need NAT for egress.
- Any new billable resource MUST come with a monthly cost estimate in the feature's `plan.md`.
  Anything estimated above $1/month MUST be justified in Complexity Tracking.
- An AWS Budget alert (default $5/month) MUST exist in infrastructure code.
- Image optimization, thumbnail generation, and similar heavy processing MUST happen ahead of
  time (at ingest, on the owner's machine), not per request in the cloud.
- Log retention MUST be bounded (default 14 days).

**Rationale**: The owner has stated a zero budget. Hidden fixed costs such as NAT Gateways or idle
databases are the most common way a "free" AWS app ends up costing $30+/month.

### II. Server-Enforced Access & Asset Isolation (NON-NEGOTIABLE)

The catalog holds licensed, paid material that only Entropy Forge employees may use.

- Only Google Workspace accounts in the `entropy-forge.io` domain may sign in. The domain check
  MUST be enforced in the backend (identity provider trigger and token verification), never
  only in UI code.
- Every data read, preview, demo, and download MUST require valid authentication enforced by
  the backend or CDN. Client-side route guards are for user experience only, never security.
- Static front-end bundles MUST NOT contain catalog data, asset URLs that grant access, or
  secrets.
- Storage MUST be private (block all public access). It is reachable only through the CDN with
  origin access control, and through short-lived signed URLs or cookies. Download links MUST
  expire within 5 minutes.
- Third-party template code (live demos) MUST run on an origin separate from the application,
  and MUST NOT be able to read app tokens or call app APIs as the user.
- Secrets (OAuth client secret, CDN signing keys) MUST live in a managed secret store and MUST
  NOT be committed. Write access to the catalog is limited to the owner's identity and to
  purpose-built functions, with least-privilege IAM.
- Archive extraction MUST reject path-traversal entries and enforce a size limit.

**Rationale**: A leak of licensed assets is the highest-impact risk to the company, and running
untrusted marketplace code in the browser is an obvious attack path.

### III. Static Front End, Serverless Backend, Everything as Code

- The web app MUST be a Next.js static export (`output: 'export'`). It MUST NOT use server-side
  rendering, route handlers that read the request, `proxy.ts`, server actions, ISR, or the
  default image optimizer.
- Routing MUST use the Next.js App Router only. React Router and other routers are prohibited.
- All data access MUST go through the Amplify Gen 2 backend (Cognito, AppSync/DynamoDB, Lambda,
  S3/CloudFront) from the client.
- All cloud infrastructure MUST be defined in code: the Amplify Gen 2 `amplify/` backend, with
  AWS CDK for custom resources. Changes made by hand in the console are prohibited, apart from
  one-time bootstrap steps documented in the repo.
- Contributors MUST read the relevant guide in `node_modules/next/dist/docs/` before writing
  Next.js code, because this Next.js version has breaking changes (see `AGENTS.md`).

**Rationale**: A static front end with a serverless backend keeps cost and operational burden near
zero. Infrastructure as code keeps the environment reproducible and reviewable.

### IV. Accessible by Default

- User-facing pages MUST meet WCAG 2.1 AA.
- Interactive controls MUST be built with React Aria Components, or have equivalent keyboard,
  focus, and screen-reader behavior. Everything MUST be keyboard-operable, with visible focus.
- Automated accessibility checks (axe) MUST report zero violations on core pages in CI.
- Text MUST meet contrast ratios against its background. Brand colors that fail 4.5:1 (e.g.,
  magenta `#B82471` on `#111`) are limited to large text and non-text accents.
- Motion MUST respect `prefers-reduced-motion`. Every image MUST have meaningful alternative text.

**Rationale**: The audience is the whole company, and accessibility retrofitted later costs far
more than accessibility built in.

### V. Tested Increments

- Every user story MUST ship with automated tests in the same change. Business logic gets unit
  tests (Vitest). UI behavior gets component tests (React Testing Library). Each P1 user journey
  gets end-to-end tests. Custom infrastructure gets CDK assertion tests (e.g., no public buckets,
  no NAT/VPC resources, budget present).
- An end-to-end test drives a journey through its real entry point, from input to observable
  result:
  - **Browser journeys** use Playwright against the built app.
  - **Non-UI journeys** (e.g., the ingest CLI) invoke the real command on fixture inputs, run every
    pipeline stage for real (detection, extraction, preview generation), and assert on the exit
    code, the report, and the writes it makes. Cloud services (S3, DynamoDB) MAY be replaced with
    mocks at the SDK boundary. Unit tests of individual stages, or a dry run that skips stages, do
    not count as end-to-end.
- Security-relevant logic (domain checks, token verification, URL/cookie signing, archive
  sanitization) MUST have unit tests that cover the rejection paths.
- A failing test, type error, or lint error MUST block merge. Tests MUST NOT be skipped or
  deleted to make a change pass without recording why in the PR.
- Each user story MUST be independently testable and demonstrable, as the spec requires.

**Rationale**: Development is largely agent-driven, so automated tests are the main evidence that
work is correct, and they keep each increment shippable.

### VI. Simplicity & Agent-Legible Code

- Build only what the current spec requires (YAGNI). Deferred features stay out of the code until
  they're specified.
- TypeScript MUST run in strict mode. ESLint MUST pass.
- Code MUST keep clear module boundaries (`src/app`, `src/components`, `src/lib/{auth,data,assets}`,
  `amplify/`, `tools/ingest/`) so a contributor or agent can work on one slice in isolation.
- Each new dependency, abstraction layer, or service beyond the approved stack MUST be justified
  in the plan's Complexity Tracking table.
- Conventions, commands, and platform caveats MUST be documented in `AGENTS.md` and kept current.

**Rationale**: Small, explicit, well-bounded code is cheaper to maintain and is where AI-assisted
development is most reliable.

## Technology & Platform Constraints

- **Front end**: Next.js 16 (App Router, static export), React 19, React Compiler, Tailwind CSS v4,
  React Aria Components.
- **Backend/hosting**: AWS Amplify Gen 2 (Hosting, Auth/Cognito with Google federation,
  Data/AppSync + DynamoDB, Functions/Lambda, Storage/S3) plus CDK custom resources (CloudFront for
  assets, budgets). Region: `us-west-2`. CloudFront certificates live in `us-east-1`.
- **Data**: DynamoDB for the catalog. Any future relational store (Aurora Serverless v2,
  MySQL-compatible) MUST be reached via the RDS Data API, without VPC-attached compute.
- **Domains**: App at `content.entropy-forge.io`. Assets/demos at `assets.entropy-forge.io`.
  DNS in Route 53.
- **Branding**: Entropy Forge identity: dark theme (`#111` background), amber `#F2A524`
  primary, magenta `#B82471` secondary, lime `#AFFC41` accent, Aeonik headings, Lato body.
- **Browsers**: latest two versions of Chrome, Edge, Firefox, Safari. Desktop first, usable at
  tablet width.
- Changing any constraint in this section requires a constitution amendment.

## Development Workflow & Quality Gates

- **Spec-driven**: every feature follows Spec Kit: `/speckit-specify` → (`/speckit-clarify`) →
  `/speckit-plan` → `/speckit-tasks` → (`/speckit-analyze`) → `/speckit-implement`. Specs describe
  what and why. Plans describe how and MUST include a passing Constitution Check.
- **Branches**: one branch per feature, named after its spec directory (e.g.,
  `001-content-forge-mvp`). Nothing is committed directly to `master` after the initial commit.
- **Pull requests**: every change merges through a PR that links its spec/issue and states how
  each touched principle was satisfied.
- **CI gates (all MUST pass)**: lint, type-check, unit and component tests, static export build,
  axe checks on core pages, CDK assertion tests. E2E tests run for changes that touch a P1 journey.
- **Commits**: Conventional Commits style (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).

## Governance

- This constitution overrides other practices and guidance in the repository. Where `AGENTS.md`
  or other docs conflict with it, the constitution wins until it's amended.
- **Amendments**: a PR that edits `.specify/memory/constitution.md`, updates the Sync Impact
  Report, bumps the version, and records the reason. The project owner (Justen L. Britain)
  approves every amendment.
- **Versioning (semver)**: MAJOR for removing or redefining principles in a backward-incompatible
  way. MINOR for adding a principle/section or materially expanding guidance. PATCH for
  clarifications and wording.
- **Compliance**: every `plan.md` MUST pass the Constitution Check before research and again after
  design. Violations MUST be justified in Complexity Tracking or the design changed. Reviewers MUST
  verify compliance on every PR. The constitution is reviewed at the start of each new project
  phase (e.g., usage tracking).
- Use `AGENTS.md` for day-to-day development guidance.

**Version**: 1.0.2 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-28
