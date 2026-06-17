# Change Log

This file records meaningful architecture and structural changes so the codebase remains understandable across sessions and contributors.

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
