# Content Forge

Content Forge is a private web catalog for a library of purchased digital assets: website
templates, PowerPoint decks, video, images, textures, and other files bought from marketplaces
such as ThemeForest. It puts everything in one place to browse by category, preview, download,
and (for website templates) try as a live demo, so assets stop getting bought twice or forgotten
on a local drive.

## Who it's for

Content Forge is for the owner of an asset library who wants to know what they already own before
starting new work. Today that's a single user: me, managing my own library. The design
allows a small team (fewer than 50 users) signing in with a Google Workspace account, but there are
no other users yet.

The project uses **generated test data only**. The ingest fixtures and the end-to-end test catalog
are synthetic, and no real personal or customer data is stored in this repository.

## Status

Early development. The MVP is fully specified and planned, and the code is at the scaffold stage
(Next.js app shell, tooling, and configuration). The work ahead is tracked in the
[Roadmap](#roadmap) below.

## Features (MVP)

- **Sign in** with a Google Workspace account (Cognito federation, domain-restricted).
- **Browse** the catalog in horizontally scrolling rows, one per content type.
- **Detail pages** with type-specific previews: screenshot galleries, slide galleries, video
  playback, image zoom, tiled texture views, and file lists.
- **Download** the original archive through a short-lived signed URL.
- **Live demos** of static website templates, isolated on their own domain.
- **Bulk ingest** CLI that imports hundreds of items and generates every thumbnail and preview
  locally.
- **Near-zero running cost**: no NAT, VPC, or always-on compute. The target is a few dollars a
  month beyond S3 storage.

## Built with

| Area | Technology |
|---|---|
| Front end | [Next.js 16](https://nextjs.org) static export (App Router), React 19 with React Compiler, [React Aria Components](https://react-spectrum.adobe.com/react-aria/), Tailwind CSS v4 |
| Backend | [AWS Amplify Gen 2](https://docs.amplify.aws/) in TypeScript: Cognito (Google federation), Amplify Data (AppSync + DynamoDB), Lambda |
| Asset delivery | Private S3 bucket behind CloudFront, with signed cookies for previews and demos and signed URLs for downloads |
| Ingest CLI | Node.js + `tsx`, `sharp`, Playwright, LibreOffice + poppler, ffmpeg |
| Testing | Vitest, React Testing Library, Playwright (mocked backend plus deployed smoke tests), axe-core, CDK assertions |
| Language & runtime | TypeScript (strict), Node.js 24 LTS |
| Process | [Spec Kit](https://github.com/github/spec-kit) spec-driven development |

## Getting started

### Run the app shell locally

Requires Node.js 24 LTS.

```bash
git clone https://github.com/bobthemagicman/content-forge.git
cd content-forge
npm ci
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Other scripts available today:

```bash
npm run build   # production build
npm run lint    # ESLint
```

### Full environment

Once the backend and ingest CLI land, running the full stack needs an AWS account, a personal
Amplify sandbox, and a Google OAuth client. The step-by-step setup, the commands for loading
sample content, and the validation scenarios are in the
[quickstart guide](specs/001-content-forge-mvp/quickstart.md).

Secrets such as OAuth client credentials and CloudFront private keys are never committed. They
live in Amplify secrets and AWS SSM, and `.env*` and key files are excluded by `.gitignore`.

## Roadmap

The MVP is broken into 127 tasks across ten phases, each tracked as a
[GitHub issue](https://github.com/bobthemagicman/content-forge/issues) (task `T001` is issue #1,
and so on). The full list, with dependencies and parallel work marked, is in
[`tasks.md`](specs/001-content-forge-mvp/tasks.md).

| Phase | Scope | Priority |
|---|---|---|
| 1. Setup | Tooling, dependencies, CI, test harnesses | — |
| 2. Foundational | Auth, data model, asset CDN, app shell | — |
| 3. Sign in with an allowed account | Landing page, Google sign-in, session handling | P1 |
| 4. Bulk ingest | CLI that imports the library and generates previews | P1 |
| 5. Browse by category | Category rows on the browse page | P1 |
| 6. Details and download | Detail page and signed downloads | P1 |
| 7. Live demos | Isolated demos of static website templates | P2 |
| 8. Rich previews | Type-specific preview components | P2 |
| 9. Browsing conveniences | "See all" pages, download counts | P3 |
| 10. Polish | Accessibility, performance, security checks, docs | — |

Later releases (out of MVP scope): search and tag filtering, an admin UI, and tracking which
projects each asset was used on.

## Project documentation

- [Requirements](docs/requirements/content-forge-mvp.md): the MVP requirements and decisions.
- [Specification](specs/001-content-forge-mvp/spec.md): user stories and acceptance criteria.
- [Implementation plan](specs/001-content-forge-mvp/plan.md): architecture and technical context.
- [Data model](specs/001-content-forge-mvp/data-model.md) and
  [contracts](specs/001-content-forge-mvp/contracts/).
- [Constitution](.specify/memory/constitution.md): the principles every change is held to (cost
  discipline, security, static export, accessibility, tested increments).

## License

[Mozilla Public License 2.0](LICENSE).
