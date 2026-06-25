# Change Log

This file records meaningful architecture and structural changes so the codebase remains understandable across sessions and contributors.

## 2026-06-20 - Minimal Audit Events Volume Chart

Changed:

- replaced the audit-events timeseries panel with a minimal single-series area chart
- kept the dashboard data flow unchanged while formatting chart axes and tooltips from the existing timeseries payload
- added empty-state handling so the chart card stays readable when no activity exists yet

Why:

- the dashboard needs a compact volume view that fits the new minimal visual direction without adding extra controls or chart clutter

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Permission-Aware Settings Actions

Changed:

- hid project-creation and member-invitation actions behind disabled settings forms for member and viewer roles
- passed the active organization role through the settings page so the UI can match the backend permission model
- kept organization creation and read-only settings context visible for all signed-in users

Why:

- the backend already restricts project creation and invitations to owner/admin roles, so the settings UI must not surface those actions as if they were available to everyone

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Permission-Aware API Key Management

Changed:

- passed the active organization role through the shared workspace resolver
- hid API key create and revoke actions on the dedicated API keys page for member and viewer roles
- kept listing access intact so lower-privilege users can still view project keys without being offered forbidden actions

Why:

- the API correctly restricts create and revoke to owner/admin roles, so the page must match that permission model instead of surfacing actions that always fail

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - API Key Management Moved Off Settings

Changed:

- removed the API keys management section from the settings page and its settings-side sub-navigation entry
- kept API key management on the dedicated `/api-keys` page only
- changed API key revoke on the dedicated page to use a bound server action instead of hidden-input form parsing

Why:

- key management now has its own page, so duplicating create and revoke controls inside settings added noise without helping the workflow
- binding the revoke action directly makes the submit path more explicit and fixes the unreliable revoke click behavior

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Dedicated API Keys Page

Changed:

- added a dedicated `/api-keys` page in the web app with a table-first API key management screen
- added sidebar navigation for API keys while preserving the active workspace query context
- updated API-key create and revoke actions so forms can return either to settings or to the dedicated API-keys page

Why:

- project API keys now have enough operational detail to deserve a dedicated page instead of living only inside settings
- keeping the page on the same workspace loader avoids a second inconsistent API-key loading path

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Minimal Sidebar Pass

Changed:

- removed extra sidebar card framing around navigation and workspace controls
- reduced sidebar copy and tightened the left-rail spacing and typography
- kept the same route-driven workspace switch behavior while making the rail read more like a utility column

Why:

- the previous shell was still visually heavier than needed for a minimal operator dashboard
- the sidebar now puts emphasis on navigation and context with fewer decorative layers

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Simplified Dashboard Styling Toward The OpenAI Platform Dashboard

Changed:

- reduced the dashboard shell chrome by flattening cards, removing gradients, and using quieter neutral tokens
- simplified section headers, filter panels, workspace summary surfaces, and navigation affordances
- kept the existing workspace behavior and coverage while shifting the interface toward a calmer operator dashboard style

Why:

- the previous refresh added too much decorative weight for a product surface that should feel closer to a restrained control panel
- the dashboard and settings pages now prioritize hierarchy, spacing, and typography over badges, shadows, and gradients

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Immediate Sidebar Workspace Switching And Shadcn-Style Shell Refresh

Changed:

- made the sidebar organization and project controls update the current route immediately instead of waiting for a second submit action
- synced the switcher client state back to the active URL-backed workspace so re-renders and reloads keep the visible selection stable
- refreshed shared web primitives and the dashboard or settings shell with more polished card, filter, table, and summary surfaces

Why:

- restore the expected workspace-switch behavior where the selected org and project become the current page context right away
- remove the stale local-state path that made the sidebar selection appear to reset after navigation or reload
- move the shell closer to the intended modern dashboard style without introducing a large external dependency path

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Web UI Coverage Gate For The Dashboard Slice

Changed:

- added a dedicated `pnpm --filter web test:ui` command that enforces 90% coverage for the current dashboard, settings, members, and shell UI slice
- added branch-focused tests for the sidebar shell, workspace switcher, settings fallback path, and dialog-driven event inspection close path

Why:

- make the new UI work fail fast when coverage drops below the required floor
- avoid claiming whole-app web coverage that the current repo does not yet meet

Docs updated:

- `docs/04-quality-gates.md`
- `docs/07-change-log.md`

## 2026-06-20 - Organization Members Page

Changed:

- added a session-protected organization members endpoint for the active workspace
- added a `/members` page in the web app and linked it from the sidebar shell
- reused the active organization context for member reads and added empty-state coverage

Why:

- expose the current organization roster without forcing workspace admins into the API directly
- keep member browsing aligned with the same org and project selection model used by the dashboard and settings pages

Docs updated:

- `docs/03-api.md`
- `docs/07-change-log.md`

## 2026-06-20 - Sidebar Dashboard Shell

Changed:

- replaced the top app header with a left sidebar shell for dashboard and settings navigation
- added a bottom workspace switcher that updates the current route with the selected organization and project context
- added layout tests for the sidebar shell and switcher behavior
- split the settings screen into smaller feature components so the web architecture gate remains green

Why:

- keep primary navigation and workspace context persistent while freeing the main canvas for dashboard and settings work
- align the shell with the repo rule that feature components stay small and composable

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Settings Sub-Navigation For Workspace Management

Changed:

- added an inner settings navigation that jumps between workspace, access, project, and API-key sections
- regrouped the settings forms and supporting cards so invitations, project setup, and key management are separated by concern
- added settings-screen tests that cover the new navigation targets and invitation-link empty state

Why:

- reduce scanning on the settings page by turning one long stack into clear management sections
- make workspace administration tasks easier to find before the broader dashboard shell changes land

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Modal Event Inspection On The Dashboard

Changed:

- replaced the inline event detail card with an on-demand modal inspection flow
- added a shared web dialog primitive using the existing Radix dialog dependency
- updated dashboard interaction tests to cover modal open, close, and fallback rendering behavior

Why:

- keep the event stream focused until a user explicitly inspects one event
- reduce dashboard layout pressure before the larger sidebar and settings UX changes land

Docs updated:

- `docs/07-change-log.md`

## 2026-06-18 - Refresh Dashboard And Settings UX

Changed:

- added a workspace summary card to the settings page with current organization, project, and key counts
- grouped settings affordances into clearer orientation, workspace, project, and key sections
- improved empty-state copy on the dashboard, project list, and API key list to point at the next step
- made the organization switcher and project list show the active selection more explicitly

Why:

- reduce the amount of scanning required to understand the selected workspace
- make the settings page feel like a workspace home instead of a raw form stack
- keep the dashboard connected to the setup flow when there are no events yet

Docs updated:

- `docs/07-change-log.md`

## 2026-06-18 - Ignore Blank Dashboard Filter Inputs

Changed:

- normalized empty dashboard query-string values to `undefined` before Zod parsing
- added a regression test for submitting the event, actor, and target filters with blank inputs

Why:

- prevent the dashboard filter form from throwing on untouched inputs during a GET submit
- preserve the existing validation rules for non-empty values while treating empty form fields as absent

Docs updated:

- `docs/07-change-log.md`

## 2026-06-18 - Simplify To The Core MVP Slice

Changed:

- removed the disconnected exports backend and web feature code
- removed Redis from the active runtime env contract and compose stacks
- removed dead web runtime code, Storybook, Playwright smoke coverage, and unused dependencies
- narrowed standard auth runtime config to provider-backed sender selection only while keeping the explicit local-auth harness

Why:

- keep the production code path limited to sign-in, workspace management, project API keys, ingest, and dashboard reads
- remove side systems and optional branches that increased maintenance cost without serving the hosted MVP
- make local and deployment setup match the currently implemented runtime surface

Docs updated:

- `README.md`
- `docs/01-agent-engineering-rules.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/04-quality-gates.md`
- `docs/05-next-steps.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`
- `apps/web/README.md`

## 2026-06-18 - Remove Seeded Local API Key

Changed:

- stopped `pnpm db:seed` from creating a fixed local API key by default
- changed local API examples to require a dashboard-created project API key
- kept explicit seed-time API key insertion available only for internal callers such as tests

Why:

- remove a machine-credential path that bypassed the dashboard-managed API key workflow
- make local and deployed usage follow the same project API key lifecycle

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Session-Scoped Dashboard Event Reads

Changed:

- moved dashboard audit-event reads off the global web API key path
- added session-authenticated project-scoped event read routes for the web app
- preserved selected organization and project context across dashboard and settings links

Why:

- ensure events written with a newly created project API key appear in the same project's dashboard
- remove the mismatch where the web UI could read a different project's data through one configured machine key

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/07-change-log.md`

## 2026-06-18 - Auth Runtime And Workspace Hardening

Changed:

- made standard API runtime require a provider-backed magic-link sender
- moved local fake magic-link delivery to an explicit dev-only auth harness entrypoint
- centralized workspace resolution for dashboard, settings, and app navigation
- made flashed API-key state one-shot and workspace-scoped
- stopped treating arbitrary auth API failures as anonymous sessions in the web app

Why:

- remove embedded runtime fallbacks that could blur development and production behavior
- keep org/project selection deterministic across dashboard and settings flows
- surface real auth/runtime failures instead of silently degrading them into sign-out behavior

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`
- `apps/api/src/modules/auth/README.md`
- `apps/web/README.md`

## 2026-06-18 - Web Container Prebuild

Changed:

- moved the `web` production build into the root Docker image build
- changed the web runtime command to serve the prebuilt Next.js output only
- added a dedicated root build script so the Docker image and repo command stay aligned
- replaced the remote Google font fetch with local system font stacks so the
  container build can run offline

Why:

- keep container startup focused on serving the app instead of compiling it
- make the deployed runtime match the production build artifact instead of rebuilding on boot
- avoid build failures in containerized environments without external font access

Docs updated:

- `README.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Low-Context Agent Quickstart

Changed:

- added a compact agent quickstart with repo map, cheap read paths, and command shortlist
- linked repo entry-point docs to the quickstart for low-context work
- replaced the generic `apps/web/README.md` boilerplate with project-specific guidance

Why:

- reduce context cost for smaller models and narrow task-oriented runs
- keep agents from wasting tokens on broad scans or framework boilerplate

Docs updated:

- `README.md`
- `docs/01-agent-engineering-rules.md`
- `docs/07-change-log.md`
- `docs/08-agent-quickstart.md`
- `apps/web/README.md`

## 2026-06-18 - Auth Sender Config Hardening

Changed:

- added an explicit `AUTH_MAGIC_LINK_SENDER` config selector for API runtime auth
- reserved `resend` as the first provider-backed sender contract with validated
  `AUTH_RESEND_API_KEY` and `AUTH_RESEND_FROM_EMAIL` env values
- made production config reject the local logging sender and missing sender selection

Why:

- prevent production auth startup from silently using a non-delivery local sender
- validate provider-specific email requirements before runtime wiring begins

Docs updated:

- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Resend Auth Sender Adapter

Changed:

- added a concrete Resend-backed magic-link sender adapter in the auth module
- kept the auth service boundary unchanged by continuing to depend on `MagicLinkSender`
- added sender tests for successful Resend requests and provider error handling

Why:

- provide the first production-capable email delivery implementation behind the existing auth boundary
- keep runtime wiring separate from provider behavior so sender selection can be tested independently

Docs updated:

- `apps/api/src/modules/auth/README.md`
- `docs/07-change-log.md`

## 2026-06-18 - Auth Runtime Sender Selection

Changed:

- updated runtime auth startup to select the Resend sender when configured
- kept the in-memory logging sender as the non-production fallback path
- added app-level tests for provider selection and local fallback behavior

Why:

- make startup wiring honor the validated sender config without changing the auth service boundary
- preserve the local sign-in workflow for development and test environments

Docs updated:

- `apps/api/src/modules/auth/README.md`
- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Alias-Only Imports In Web

Changed:

- rewrote local `apps/web` imports and re-exports to use the `@/...` alias
- added an ESLint restriction that rejects `./` and `../` local imports in `apps/web`
- documented the alias-only import rule in the web architecture and quality gates

Why:

- keep moves and refactors from churning deep relative import paths
- make module ownership and cross-feature boundaries easier to scan during review

Docs updated:

- `docs/02-architecture.md`
- `docs/04-quality-gates.md`
- `docs/07-change-log.md`

## 2026-06-18 - Task Tracking Workflow Bootstrap

Changed:

- made the `tasks/` directory the canonical task tracker
- added category-scoped task files under `tasks/`
- added `scripts/task-sync.sh` for local task validation
- added hard task workflow rules to `AGENTS.md` and `docs/01-agent-engineering-rules.md`

Why:

- keep task history inside the repository where the agent can update it deterministically
- avoid agents inventing hidden state outside `tasks/*.txt`

Docs updated:

- `README.md`
- `docs/01-agent-engineering-rules.md`
- `docs/07-change-log.md`

## 2026-06-18 - Narrow Hosted MVP Path

Changed:

- added a dedicated `api-keys` backend slice with service, Postgres adapter, and tested Fastify routes
- extended the web `/settings` flow to support project selection, API key creation, API key revocation, and first-event onboarding
- added a dashboard empty state that points users back to the onboarding path
- updated Coolify deployment to describe `web` and `api` as one hosted MVP stack

Why:

- the project already had enough platform surface to be useful, but it still lacked the machine credential workflow needed for real adoption
- the fastest path to usefulness is a single hosted ingest-to-investigate slice, not a broader unfinished platform surface

Docs updated:

- `README.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/04-quality-gates.md`
- `docs/06-deployment.md`

## 2026-06-17 - API Contract Hardening

Changed:

- added OpenAPI generation at `/api/v1/openapi.json`
- centralized shared request and response schemas
- centralized API error formatting
- made `/api/v1` the only supported API contract path

Why:

- keep runtime contract, tests, and docs derived from the same source
- reduce drift between implementation and documentation

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/04-quality-gates.md`

## 2026-06-17 - Audit Event Route Refactor

Changed:

- split `audit-events/routes.ts` into smaller source-adjacent modules:
  - `http-contract.ts`
  - `query.ts`
  - `presenters.ts`
  - `request-principal.ts`
- kept route registration thin and pushed pure logic into directly testable helpers

Why:

- make route code smaller
- keep helpers pure and easier to test
- keep ownership boundaries obvious for future agents and contributors

Docs updated:

- `README.md`
- `docs/04-quality-gates.md`

## 2026-06-17 - Colocated Test Layout

Changed:

- moved tests next to the code they cover under local `__tests__` directories
- changed integration discovery to `src/**/__tests__/**/*.integration.test.ts`
- updated package and app TypeScript test includes to follow the colocated layout

Why:

- keep file ownership clearer
- make code and tests easier to change together
- reduce the top-level test bucket effect

Docs updated:

- `README.md`
- `docs/04-quality-gates.md`

## Web Frontend Architecture Baseline

Established `apps/web` as a pure Next.js UI that consumes the existing
`apps/api` Fastify service. The frontend must not add Next.js route handlers or
API endpoints. The initial audit-events vertical slice follows the API app's
thin adapter, service, boundary-validation, and presenter patterns.

Expanded the web audit-events slice with server-loaded filters, cursor
pagination, event stats, and timeseries charting. Browser refetching remains
deferred until the API has an explicit browser-session principal model.

Hardened the web architecture by moving page data composition into an injectable
feature server loader, constraining API paths with generated OpenAPI contract
types, and expanding architecture checks for component and server/client
boundaries.

Introduced a Tailwind-first UI system for `apps/web`. Repeated visual patterns
now live in small shared primitives, audit-event feature components compose those
primitives directly, and global CSS is limited to Tailwind import, semantic
tokens, reset, and base body styles.

Started the production platform foundation with pure API services for custom
magic-link auth, organizations/projects/invitations, and async export jobs. The
web app now has matching feature boundaries for auth, organizations,
invitations, and exports. Fastify routes and persistence are intentionally left
for the next tested vertical slice.

Added the first tested auth route adapter for magic-link requests, session
creation, logout, and current-user lookup. The web auth client now targets those
API paths directly and the shared API client includes credentials for
cookie-backed browser sessions.

Added the first platform persistence layer: Drizzle schema and migration for
users, magic links, sessions, organization memberships, invitations, and export
jobs, plus Postgres repository adapters for auth, platform, and export services.
Route registration remains deferred until auth/email/cookie config is wired.

Added the auth email delivery boundary with an in-memory sender for development
and tests, added auth-specific environment validation, documented the magic-link
URL contract, and allowed `buildApp()` to register auth routes through an
explicit injected `AuthService`.

Added browser session principal resolution with `sessionAuthPlugin` and expanded
`/me` to support real organization/project membership context through an
injectable platform context service. Machine API-key authentication remains
separate for ingestion routes.

Added the first organizations/projects API slice with role-checked platform
service methods, Postgres repo support for membership/project lookups, and
tested Fastify route adapters for organization and project management.

Added the invitations API slice with token hashing, invite/accept/revoke service
methods, Postgres repo support for invitation lookup and state updates, and
tested route adapters for invitation lifecycle operations.

Added the exports backend slice with export status transitions, in-memory object
storage, CSV generation, pending-job worker processing, and tested routes for
creating, listing, checking, and downloading completed exports.

Added the first web browser-auth slice. The Next.js app now has sign-in,
magic-link sent, callback, logout, and protected-shell flows that call the
existing Fastify API directly. The shared web API client supports raw responses
for cookie exchange and server-side cookie forwarding for `/api/v1/me`, while
the no-Next-route-handlers boundary remains intact.

Mounted auth routes in runtime API infrastructure mode. `buildApp({
useInfrastructure: true })` now creates the Postgres auth repo, platform context
service, auth service, and local magic-link sender, then registers browser auth
routes under `/api/v1`. Non-production startup logs generated magic-link URLs
for local testing.

Fixed migration metadata for the platform foundation migration so
`drizzle-kit migrate` discovers `0001_platform_foundation.sql` on fresh
databases instead of requiring manual SQL application.

Added the first web organization/project management slice. Runtime API
infrastructure mode now registers session auth and platform routes from the
Postgres platform service. The web app has a protected `/settings` screen for
organization creation, project creation, invitation-token creation, and
invitation acceptance, all through direct Fastify API calls.

Fixed magic-link lookup for repeated sign-in attempts. The Postgres auth repo
now resolves the newest magic link for an email address, preventing older
consumed or expired links from causing fresh callback tokens to fail.

Changed the web invitation workflow to display a full invitation URL after
creating an invite, instead of exposing only the raw token.

Fixed platform membership lookup after invitation acceptance. The Postgres
platform repo now queries memberships by organization and user together, so
project listing works for newly invited users even when the organization already
has other members.

Made organization membership idempotent for invitation acceptance. The platform
service now returns an existing membership instead of creating a duplicate, the
database migration adds a unique organization/user membership index after
removing duplicates, and `/me` context loading defensively deduplicates stale
duplicate rows.

Hardened database behavior for invitations and exports. Pending invitations are
now unique per organization/email, invitation acceptance verifies the signed-in
user email, and export listing/worker pickup uses deterministic ordering.
## 2026-06-25 - Shared-Domain Auth Cookie Redirect Flow

Changed:

- replaced the Next.js callback cookie-mirroring step with API-owned browser redirect endpoints for sign-in confirmation and sign-out
- added `AUTH_SESSION_COOKIE_DOMAIN` so production `app.*` and `api.*` subdomains can share one HttpOnly session cookie
- updated the web callback and logout forms to post directly to the API public origin while keeping page protection on `/api/v1/me`

Why:

- remove fragile cross-origin `Set-Cookie` mirroring logic from the web app
- keep one session authority and one browser cookie across the deployed web and API origins
- make production auth behavior match the browser’s normal cookie and redirect model

Docs updated:

- `README.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/06-deployment.md`

## 2026-06-18 - Task Directory Split

Changed:

- replaced the single `tasks.txt` file with category-scoped files under `tasks/`
- moved existing open work into per-category task files
- moved workflow history into `tasks/workflow.txt`
- updated repository docs to reference `tasks/*.txt` instead of `tasks.txt`

Why:

- keep each task file small and focused enough to scan quickly
- make task ownership and category boundaries explicit in the repository

Docs updated:

- `README.md`
- `AGENTS.md`
- `docs/01-agent-engineering-rules.md`
- `docs/07-change-log.md`
