# Change Log

This file records meaningful architecture and structural changes so the codebase remains understandable across sessions and contributors.

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
