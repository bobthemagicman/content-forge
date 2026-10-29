# Feature Specification: Content Forge MVP

**Feature Branch**: `001-content-forge-mvp`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Content Forge: an internal catalog where Entropy Forge employees browse, preview, and download the company's purchased templates and media (website templates, PowerPoint templates, video, images, textures, other). Converted from `docs/requirements/content-forge-mvp.md` (v4), which also records the approved technical decisions for planning."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with a company account (Priority: P1)

An Entropy Forge employee visits Content Forge and sees a public landing page that explains the tool. They sign in with their company Google Workspace account and arrive at the catalog. Anyone without an `@entropy-forge.io` account is turned away, and nobody sees catalog content before signing in.

**Why this priority**: The catalog holds licensed, paid material, so access control has to exist before any content is exposed. Every other story depends on it.

**Independent Test**: Deploy the landing page and sign-in with an empty catalog. Confirm that a company account reaches the signed-in home, a personal Google account is rejected with a clear message, and signed-in pages and assets are unreachable without signing in.

**Acceptance Scenarios**:

1. **Given** a visitor who isn't signed in, **When** they open the site, **Then** they see the landing page with Entropy Forge branding, a short description, and a "Sign in with Google" action, and no catalog content, thumbnails, or item details.
2. **Given** a visitor with an `@entropy-forge.io` Google Workspace account, **When** they sign in, **Then** they land on the signed-in home (browse) page.
3. **Given** a visitor using a personal or other-domain Google account, **When** they try to sign in, **Then** they're refused and returned to the landing page with a "company accounts only" message.
4. **Given** a signed-in user, **When** they return to the landing page, **Then** they're taken straight to the browse page.
5. **Given** a signed-in user, **When** they sign out, **Then** their session ends and catalog pages, previews, demos, and downloads are no longer accessible from that browser.
6. **Given** someone who isn't signed in, **When** they request a catalog page, preview image, demo, or download link directly, **Then** access is denied.

---

### User Story 2 - Browse the catalog by category (Priority: P1)

A signed-in employee sees the catalog laid out in horizontal rows, one row per content type (Website Templates, PowerPoint Templates, Video, Images, Textures, Other), similar to a streaming service. Each card shows a thumbnail, title, and type badge. They scroll through rows and jump to the type they're looking for.

**Why this priority**: Seeing what the company owns is the core value. It stops assets being bought twice and helps consultants find a starting point for client work.

**Independent Test**: With a seeded catalog containing items of several types, a signed-in user can see every published item grouped by type and move through the rows with mouse, trackpad, and keyboard alone.

**Acceptance Scenarios**:

1. **Given** published items of several types, **When** a signed-in user opens the browse page, **Then** they see one row per type that has items, in a fixed order, and each card shows a thumbnail, title, and type badge.
2. **Given** a type with no published items, **When** the browse page loads, **Then** no row is shown for that type.
3. **Given** a row with more items than fit on screen, **When** the user uses the previous/next controls, scrolls horizontally, or presses arrow keys inside the row, **Then** the row scrolls to show more items, and Tab moves focus to the next row.
4. **Given** the browse page, **When** the user picks a content type from the page's type navigation, **Then** the view jumps to that type's row.
5. **Given** an empty catalog, **When** the browse page loads, **Then** an empty-state message appears instead of empty rows.
6. **Given** slow-loading data, **When** the page is loading, **Then** placeholder rows/cards are shown and the layout doesn't jump when thumbnails arrive.

---

### User Story 3 - View an item's details and download it (Priority: P1)

From a card, the employee opens the item's detail page. It shows the description, tags, source marketplace, license type, file name and size, type-specific facts (such as video length or slide count), and a preview. One click downloads the original file exactly as purchased.

**Why this priority**: Downloading is the action that delivers value. Browsing without downloading doesn't meet the MVP.

**Independent Test**: With one seeded item, a signed-in user opens its detail page from a card, sees its information and preview, and downloads a file identical to the original purchase. The download is recorded.

**Acceptance Scenarios**:

1. **Given** a card on the browse page, **When** the user activates it, **Then** the item's detail page opens with its title, type, description, tags, source marketplace (linked to the original listing), license type, original file name, download size, and type-specific facts.
2. **Given** a detail page, **When** the user selects Download, **Then** the original file (usually a zip archive) starts downloading under its original file name within about a second, and the download is recorded against the item and user.
3. **Given** a download link that was issued earlier, **When** it's used more than 5 minutes after it was issued, **Then** it doesn't work. (Links are only ever issued to signed-in users.)
4. **Given** a link to an item that doesn't exist, **When** it's opened, **Then** a "not found" state appears with a way back to browsing.
5. **Given** an item whose stored file is missing, **When** the user selects Download, **Then** they see an error message instead of a broken or empty download.

---

### User Story 4 - Add the existing library to the catalog in bulk (Priority: P1)

The catalog owner points a bulk import tool at a folder of purchased files (hundreds of items). For each item, the tool works out the content type, unpacks archives, finds the demo entry page for website templates, generates thumbnails and previews, uploads everything, and creates or updates the catalog entry. A report at the end lists any item it couldn't process.

**Why this priority**: The catalog is empty without it. Entering hundreds of items by hand is unrealistic, and the owner has asked for previews to be generated automatically.

**Independent Test**: Run the tool on a small folder with one item of each type, including a website template with nested archives and a zipped PowerPoint. Confirm each item appears in the catalog with the correct type, thumbnail, and preview, and that re-running the import updates the items without creating duplicates.

**Acceptance Scenarios**:

1. **Given** a folder of purchased files, **When** the owner runs a batch import, **Then** every item is processed. Failures are listed in a report and don't stop the rest of the batch.
2. **Given** an archive with an HTML entry page, **When** it's imported, **Then** it's classified as a website template, its demo entry page is detected, and desktop and mobile screenshots are generated.
3. **Given** a zipped PowerPoint template (`.ppt`/`.pptx`), **When** it's imported, **Then** the primary deck is found, previews of the first slides (up to 12) are generated, and only the original zip and the previews are stored.
4. **Given** a video, **When** it's imported, **Then** its duration and resolution are recorded and a poster frame plus a short (≤30s) preview clip are generated.
5. **Given** an image or texture, **When** it's imported, **Then** resized previews are generated and its dimensions are recorded.
6. **Given** an item that was already imported, **When** it's imported again, **Then** its catalog entry and previews are updated, not duplicated.
7. **Given** the owner wants to check before uploading, **When** they run a dry run, **Then** the tool reports the detected type, demo entry page, and details for each item without changing anything.
8. **Given** an item where the automatic guess is wrong (type, title, demo entry page, or primary deck), **When** the owner supplies an override for that item, **Then** the override wins.
9. **Given** item details supplied in a manifest or a per-item details file, **When** imported, **Then** those values are used. Missing values fall back to defaults (title from the file name, license type "Unknown").

---

### User Story 5 - Try a website template's live demo (Priority: P2)

On a website template's detail page, the employee opens a live demo in a new tab and clicks around the template as it would run, without downloading or setting it up locally.

**Why this priority**: It makes judging templates much faster, but browsing and downloading already deliver the MVP without it.

**Independent Test**: With one imported static website template, a signed-in user opens the live demo from the detail page and the template renders with all its styles, scripts, and images working. The same demo URL refuses access when the user isn't signed in.

**Acceptance Scenarios**:

1. **Given** a website template that can run as static files, **When** the user selects Live Demo, **Then** the template opens in a new tab with its pages, styles, scripts, and images working.
2. **Given** a template that can't run as static files (it needs a build step or server software), **When** its detail page is shown, **Then** no Live Demo action appears, and a link to the vendor's own demo appears when one is recorded.
3. **Given** a demo is open, **When** the template's own code runs, **Then** it can't read the user's sign-in session or call the catalog or download services. (It can see other previews and demos, which the signed-in user can already see.)
4. **Given** a user isn't signed in, **When** they open a demo URL directly, **Then** access is denied.
5. **Given** a long working session, **When** the user's asset access is about to expire, **Then** it's renewed automatically so previews and demos keep working without a manual sign-in.

---

### User Story 6 - Rich type-specific previews (Priority: P2)

Each detail page shows a preview that suits its type: a screenshot gallery for website templates, a slide gallery for PowerPoints, a playable preview clip for video, a zoomable large view for images, and a tiled view at several scales for textures. Other files show their file listing.

**Why this priority**: Users can judge an asset without downloading it, but the thumbnails and details from Story 3 already support the MVP decision.

**Independent Test**: With one imported item of each type, each detail page shows the preview for its type and every preview image has descriptive alternative text.

**Acceptance Scenarios**:

1. **Given** a PowerPoint template, **When** its detail page loads, **Then** a gallery of its first slides (up to 12) is shown.
2. **Given** a video, **When** the user plays the preview, **Then** a short preview clip starts playing within 2 seconds, without downloading the full original.
3. **Given** a texture, **When** its detail page loads, **Then** it's shown tiled at two or three scales.
4. **Given** an "Other" item, **When** its detail page loads, **Then** its description and the archive's file listing are shown.

---

### User Story 7 - Browsing conveniences (Priority: P3)

The employee opens a "See all" grid for a content type, sees how many times an item has been downloaded, and follows a link to the vendor's own demo when no hosted demo exists.

**Why this priority**: These help, but they aren't needed to find and download assets.

**Independent Test**: The "See all" page for one type lists every item of that type, and a downloaded item's count goes up by one per download.

**Acceptance Scenarios**:

1. **Given** a category row, **When** the user selects "See all", **Then** a grid of every published item of that type is shown.
2. **Given** an item has been downloaded N times, **When** its detail page is shown, **Then** it shows a download count of N.

---

### Edge Cases

- **Wrong account type**: Personal Gmail and other-domain accounts are rejected, with a message explaining that only company accounts are allowed.
- **Ex-employees**: A user removed from the company Workspace can't sign in again. Any existing session ends within the session lifetime (≤7 days).
- **Access expires mid-session**: Previews and demos renew access automatically. If renewal fails, the user is asked to sign in again; images don't just break silently.
- **Download link shared with someone else**: The link stops working after 5 minutes and grants nothing else.
- **Missing stored file**: The download shows an error and the failure is logged for the owner.
- **Download logging fails**: The download still goes ahead and the logging failure is recorded for the owner.
- **Unknown item link**: A not-found state is shown.
- **Empty catalog / empty type**: An empty-state message, and types without items are hidden.
- **Nested archives** (a zip inside the downloaded zip, common in marketplace packages): The importer looks inside them.
- **Unsafe archives**: Entries that would write outside the extraction folder are rejected. Archives that expand past a maximum size are rejected and reported.
- **Corrupt or unreadable files**: The item is reported as failed and the batch continues.
- **Several decks or several HTML pages in one package**: The importer picks a primary one (the largest deck; the shallowest entry page, preferring folders like `demo`, `html`, `dist`, `template`), and the owner can override it.
- **Slide previews render imperfectly** (e.g., missing fonts): Fonts bundled with the template are used when present, preview-grade fidelity is acceptable, and the owner can supply a manual preview instead.
- **Templates that can't run statically** (build-required source, server-side themes): No hosted demo. The vendor demo link is used if one is recorded.
- **Very large files** (multi-GB video or archives): Downloads stream directly and the detail page shows the file size before downloading.
- **Re-importing an item**: Its entry is updated, not duplicated.

## Requirements *(mandatory)*

### Functional Requirements

**Access & identity**

- **FR-001**: System MUST let users sign in only with a Google Workspace account in the `entropy-forge.io` domain, and MUST reject every other account with an explanatory message.
- **FR-002**: System MUST enforce the domain restriction on the server side, not only in the user interface.
- **FR-003**: System MUST show a public landing page with branding, a description, and the sign-in action, and MUST NOT expose any catalog content, thumbnails, or item details there.
- **FR-004**: System MUST redirect signed-in users from the landing page to the browse page, and users who aren't signed in from any other page to the landing page.
- **FR-005**: System MUST deny access to catalog data, previews, demos, and downloads to anyone who isn't signed in, including when the URLs are requested directly.
- **FR-006**: System MUST keep users signed in across browser restarts for a configurable period (default 7 days) and MUST provide sign-out, which ends access to all catalog resources from that browser.

**Browsing**

- **FR-007**: System MUST show signed-in users a browse page with one horizontally scrollable row per content type that has published items, in this order: Website Templates, PowerPoint Templates, Video, Images, Textures, Other.
- **FR-008**: Each item card MUST show a thumbnail, title, and content-type badge, and MUST open the item's detail page when activated.
- **FR-009**: Rows MUST be operable by mouse/trackpad scrolling, labeled previous/next controls, and keyboard (arrow keys within a row, Tab between rows).
- **FR-010**: Browse page MUST provide navigation to jump to a specific content type.
- **FR-011**: Browse page MUST show loading placeholders while data loads and an empty state when there are no published items.
- **FR-012**: Rows MUST load more items as the user scrolls, so large categories don't slow down the first view.
- **FR-013** *(P3)*: System SHOULD provide a "See all" grid page per content type.
- **FR-014**: The page header MUST show the signed-in user's name or avatar and a sign-out action.

**Item details & download**

- **FR-015**: System MUST provide a detail page per item showing title, type, description, tags, source marketplace with a link to the original listing, license type, original file name, download size, and type-specific facts (video duration/resolution, slide count, image dimensions, archive file listing).
- **FR-016**: Detail pages for unknown items MUST show a not-found state with a link back to browsing.
- **FR-017**: Users MUST be able to download the original file exactly as purchased, under its original file name.
- **FR-018**: Download links MUST be issued only to signed-in users and MUST expire within 5 minutes.
- **FR-019**: Downloads MUST NOT be slowed or size-limited by the application itself; multi-GB files must download reliably.
- **FR-020**: System MUST record each download (item, user, time) and keep a running download count per item. A recording failure MUST NOT block the download.
- **FR-021** *(P3)*: Detail pages SHOULD display the item's download count.
- **FR-022**: System MUST show a clear error when a download can't be provided.

**Previews & live demos**

- **FR-023**: Every item MUST have a thumbnail. Items without a generated thumbnail MUST show an icon for their type.
- **FR-024** *(P2)*: Detail pages MUST show a type-appropriate preview: website template screenshot gallery (desktop and mobile), PowerPoint gallery of up to the first 12 slides, video preview clip of ≤30 seconds, zoomable large image, tiled texture view at 2–3 scales, and file listing for other items.
- **FR-025**: Every preview image MUST have alternative text (default: item title + "preview").
- **FR-026** *(P2)*: For website templates that can run as static files, System MUST provide a Live Demo that opens the template in a new tab with its pages and assets working.
- **FR-027** *(P2)*: Demos MUST be isolated so template code can't read the user's sign-in session or call the catalog or download services. Demo code MAY read other previews and demos, which are already visible to any signed-in employee.
- **FR-028** *(P2)*: When no hosted demo exists and a vendor demo link is recorded, the detail page SHOULD offer the vendor demo link instead.
- **FR-029**: Access to previews and demos MUST renew automatically during an active session, and MUST recover after an access-expired response without the user losing their place.

**Catalog import (owner)**

- **FR-030**: The owner MUST be able to import a whole folder of items in one batch run, as well as a single item.
- **FR-031**: The importer MUST classify each item's type automatically (website template, PowerPoint template, video, image, texture, other), and the owner MUST be able to override it per item. Textures are classified only when flagged or when the source folder is named for them.
- **FR-032**: The importer MUST unpack archives, including archives nested inside them, MUST reject entries that would write outside the extraction folder, and MUST enforce a maximum unpacked size.
- **FR-033**: The importer MUST generate the thumbnails and previews defined in FR-024 automatically for each type.
- **FR-034**: For website templates, the importer MUST detect the demo entry page (owner can override) and store a runnable copy for the live demo. Website templates are the only type with an unpacked copy stored.
- **FR-035**: For PowerPoint templates (`.ppt`/`.pptx`, always zipped), the importer MUST find the primary deck (owner can override) and store only the original archive plus generated previews.
- **FR-036**: The importer MUST accept item details from a manifest or a per-item details file (title, type, description, tags, source marketplace, source URL, vendor demo URL, license type, purchase date), with defaults for anything missing (title from file name; license type "Unknown").
- **FR-037**: Imports MUST be repeatable: re-importing an item updates it instead of duplicating it, an interrupted batch can resume where it stopped, and failures are written to a report without stopping the batch.
- **FR-038**: The importer MUST offer a dry-run mode that reports what it would do without changing anything.
- **FR-039**: The importer MUST check for its required local tools at startup and report any that are missing.
- **FR-040**: Only the owner MUST be able to add or change catalog entries. Employees have read and download access only.

**Branding & experience**

- **FR-041**: The interface MUST follow Entropy Forge branding (dark theme, brand colors, Aeonik headings, Lato body text, white wordmark logo) while meeting the contrast requirements in SC-007.
- **FR-042**: The interface MUST support the latest two versions of Chrome, Edge, Firefox, and Safari, desktop first and usable at tablet width, and MUST respect the user's reduced-motion preference.

### Key Entities *(include if feature involves data)*

- **Content Item**: One purchased asset. It has a unique human-readable identifier (slug), title, content type, publication status (draft or published), description, tags, source marketplace, source listing URL, optional vendor demo URL, license type (Regular, Extended, Other, Unknown), purchase date, publication date, original file reference with file name and size, optional demo entry page, thumbnail and preview references, type-specific facts, and a running download count.
- **Content Type**: A fixed set (Website Template, PowerPoint Template, Video, Image, Texture, Other). It sets the browse row order and which previews and actions apply.
- **Preview Asset**: A generated image or clip that belongs to a Content Item (thumbnail sizes, gallery images, video poster and clip, demo screenshots).
- **Download Event**: A record that a user (by company email) downloaded a Content Item at a given time.
- **Employee (User)**: A signed-in person identified by their company Google Workspace account. All employees have the same access in the MVP. The owner also has import rights.
- **Import Report**: The result of a batch import: per-item status, detected type, and any errors.
- *(Future, out of scope)* **Client**, **Project**, **Content Usage**: which client projects used which items, for reference and license compliance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in employee can go from the browse page to a downloaded asset they recognize in under 60 seconds and no more than 3 interactions.
- **SC-002**: 100% of sign-in attempts from non-`entropy-forge.io` accounts are rejected, and security testing finds no catalog data, preview, demo, or download reachable without a valid session.
- **SC-003**: The whole existing library (hundreds of items) can be imported in one unattended batch run. At least 95% of items are classified and previewed correctly with no manual override, and 100% of failures appear in the import report.
- **SC-004**: The first category rows appear within 2.5 seconds of opening the browse page on a broadband connection (Lighthouse desktop defaults).
- **SC-005**: A download starts within 1 second of selecting Download, and download links stop working within 5 minutes of being issued.
- **SC-006**: At least 90% of website templates that can run as static files open as a working live demo after import, with no manual fixes.
- **SC-007**: The landing, browse, and detail pages meet WCAG 2.1 AA, are fully keyboard-operable, and have no automated accessibility violations.
- **SC-008**: Monthly running cost, excluding file storage, stays at or below $5 at current usage, and an alert fires if it goes over.
- **SC-009**: Re-running an import of an already-imported folder produces zero duplicate catalog entries.

## Assumptions

- The catalog holds hundreds of items today, tens to low hundreds of GB in total, and grows through occasional purchases.
- Users are Entropy Forge employees: the owner at first, then all staff (software engineering consultants). Everyone has the same view and download rights. There are no per-item permissions.
- The owner is the only person who imports or edits content during the MVP. Imports run from the owner's own computer.
- Website templates that need a build step or server software get no hosted demo.
- Item details (source URL, license, purchase date) are entered through the manifest or per-item details files for now. Importing marketplace purchase-history exports is deferred until sample exports are available.
- No asset has been used on a client project yet, so the future usage tracking won't need historical data backfilled.
- Entropy Forge's Aeonik font license covers use in this application. Brand colors and the logo come from https://entropy-forge.io.
- The app will be served at `content.entropy-forge.io`, with previews and demos on a separate subdomain (`assets.entropy-forge.io`). DNS is managed in Route 53.
- There is one production environment (`master`). Separate personal environments are used for development. They run the app on `localhost` with their own temporary asset address instead of `assets.entropy-forge.io`, and the cost alert exists only in production.

### Out of Scope (this release)

- Search and tag filtering
- An admin interface for managing content (import is owner-run only)
- Roles or permissions beyond "employee" and "owner"
- Tracking which client projects used which assets, and license-compliance reporting (next phase)
- Favorites, recently viewed, and an analytics dashboard
- Importing marketplace purchase-history exports

### Constraints & Prior Decisions (inputs to `/speckit-plan`)

The owner approved these during requirements gathering. Full rationale, data model, routes, and branding tokens are in `docs/requirements/content-forge-mvp.md`.

- The front end is a static site (no server-side rendering) built with Next.js 16 (App Router only, no React Router), React 19, Tailwind CSS v4, and React Aria Components.
- Hosting and backend are on AWS Amplify Gen 2 in `us-west-2`. Custom infrastructure is defined with AWS CDK inside the Amplify backend.
- Sign-in uses Amazon Cognito with Google federation (not Auth.js, which needs a server).
- Catalog data is in DynamoDB. A relational database (Aurora, MySQL-compatible) is deferred to the usage-tracking phase and, when added, is reached without VPC networking.
- Cost: as close to zero as possible. No NAT Gateway, no always-on compute.
