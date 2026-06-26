# Architecture

AuditTrail uses a TypeScript monorepo with small deployable apps and narrow shared packages.

## Extraction Posture

This repository is intentionally an audit-log product, not a generic SaaS
boilerplate. The code should still be shaped so later extraction into a
separate boilerplate repo is mechanical.

Use these labels when changing architecture:

- `platform-core`: would exist in almost any multi-tenant SaaS
- `platform-extension`: reusable SaaS capability that this repo may add later
- `audit-product`: specific to AuditTrail's event-ingest and event-read product

The current source-root boundary map for future static enforcement lives in
`packages/architecture-boundaries/src/rules.ts`.

The rule is strict: `platform-*` code must not depend on `audit-product` code.
Audit-specific modules may depend on platform modules, but never the reverse.

## Apps

`apps/api` owns HTTP behavior:

- request validation
- API key authentication
- rate limiting
- event ingestion
- event reads
- API-specific tests and coverage gates

`apps/web` owns the hosted MVP user journey. It should call the API instead of importing API internals.

Current classification:

- `apps/api`: mixed `platform-core` and `audit-product`, with boundaries kept at the module level
- `apps/web`: mixed `platform-core` and `audit-product`, with boundaries kept at the feature level

## Packages

`packages/domain` contains pure schemas and domain types. It must not import framework, database, filesystem, queue, or env code.

Pricing policy also lives in `packages/domain`. The pricing catalog, plan ids,
and UTC month-window helpers are code-defined so both API adapters and tests can
share one pure source of truth for quotas.

`packages/config` contains reusable config parsing helpers.

`packages/architecture-boundaries` contains typed source-root boundary metadata
for future architecture scanners. It is build-time metadata only and does not
participate in runtime behavior.

`packages/db` contains Drizzle schema, database client creation, migrations, and seed helpers.

`packages/testkit` contains reusable test helpers only.

Current classification:

- `packages/config`: `platform-core`
- `packages/db`: mixed infrastructure for both platform and audit modules
- `packages/domain`: mixed pure platform and audit domain helpers, which should stay separated by folder and import direction
- `packages/testkit`: `platform-core`

## API Module Shape

API feature modules should stay small:

```text
module/
  routes.ts
  service.ts
  repo.ts
```

- `routes.ts`: HTTP, auth principal, request/response validation
- `service.ts`: business workflow
- `repo.ts`: persistence interface or in-memory test adapter
- `postgres-repo.ts`: Postgres adapter when needed

Routes should depend on services. Services should depend on repo interfaces. Tests can inject fake or in-memory services to avoid slow infrastructure.

For future extraction, module shape should also preserve domain ownership:

- `platform-core` modules may depend on shared packages and other platform modules
- `audit-product` modules may depend on platform modules
- platform modules must never import audit services, audit schemas, or audit repos

## Current Event Flow

```text
Client
  -> Fastify rate limiter
  -> API key auth
  -> Zod payload validation
  -> Audit event service
  -> Postgres repo
  -> organization_monthly_usage quota update
  -> audit_events table
```

The read path uses the same API key principal to scope events to the authenticated project.
Quota enforcement happens only on the public ingest path. Event reads, stats,
and timeseries remain available after a workspace reaches its monthly included
event limit.

This entire event flow is `audit-product`.

## Web Frontend Architecture

`apps/web` is a pure Next.js UI application. It must consume the existing
Fastify API under `apps/api` and must not introduce Next.js route handlers,
`pages/api` endpoints, proxy routes, or backend-for-frontend endpoints.

Frontend modules should mirror the successful API boundaries:

- route files are thin render adapters
- feature services own use cases
- API clients own HTTP calls to `/api/v1`
- domain modules own schemas, query parsing, and pure transformations
- presenters convert API DTOs into view models
- components render JSX only and stay under 120 lines

Feature code belongs under `apps/web/src/features/<feature>`. Shared primitives
belong under `apps/web/src/components/ui`, and shared infrastructure belongs
under `apps/web/src/lib`. Server data is owned by server component loaders and
feature-owned API clients, not by global client stores.

Protected browser screens must use the API-owned session model. Server
components forward the incoming HttpOnly session cookie to `apps/api`, and
client-side code may call browser-safe API endpoints with credentials included.
For split `app.*` and `api.*` production deployments, the API owns both sign-in
confirmation and sign-out redirects so the browser keeps one shared
domain-scoped session cookie instead of a mirrored web-only copy.
Do not expose ingestion or machine API keys through `NEXT_PUBLIC_*` variables.

The current hosted MVP slice is:

- browser sign-in
- organization creation
- project creation
- project API key generation and revocation
- audit-event ingestion through the public API
- event inspection through list, stats, and timeseries views

The frontend must keep this flow as a direct Fastify API consumer and use
`/api/v1/me` to protect browser sessions.

Feature pages should use a feature-owned server loader rather than composing
multiple services directly in `app/**/page.tsx`. Route files parse framework
input and render screens; loaders compose server-only API clients and feature
services. Loaders must support dependency injection for tests, matching the
API app's injectable route/service pattern.

API paths in `apps/web` are constrained by generated OpenAPI contract types from
`apps/api`. Feature API clients still Zod-validate responses at the boundary so
runtime failures remain explicit. Regenerate contract types with
`pnpm --filter web api:types` after API contract changes.

### Web UI System

`apps/web` uses a Tailwind-first UI system. Global CSS is limited to Tailwind
import, semantic CSS variables, document reset, and base body styles. Repeated
visual patterns belong in small primitives under `apps/web/src/components/ui`;
feature components compose those primitives with Tailwind utilities and must not
depend on broad global class selectors.

Shared primitives should stay generic: `Button`, `Input`, `Label`, `Card`,
`DataTable`, `EmptyState`, `PageShell`, `SectionHeader`, `MetricCard`,
`PaginationLink`, and `ChartPanel`. Feature-specific presentation remains in the
feature module, while business logic remains in domain, service, API, hook, or
server-loader modules.

All local imports inside `apps/web` must use the `@/...` alias rooted at
`apps/web`. Relative local imports such as `./foo` or `../bar` are not allowed.
This keeps file moves mechanical and makes cross-feature boundaries easier to
scan in reviews.

### Platform Modules

Production platform behavior starts in pure API modules before routes are added.
Custom auth lives under `apps/api/src/modules/auth`, organization/project
membership logic under `apps/api/src/modules/platform`, and machine credential
management under `apps/api/src/modules/api-keys`. These modules follow the same
pattern as audit events: Zod at boundaries, pure services, repository
interfaces, and tests before Fastify routes.

The web app mirrors those platform capabilities with feature boundaries under
`apps/web/src/features/auth`, `organizations`, `invitations`, `api-keys`, and
`onboarding`.

The organization/project UI lives under `apps/web/src/features/organizations`
and the protected `/settings` route. It uses server actions only as direct
Fastify API clients for create/invite/accept workflows; it does not introduce
Next.js route handlers or proxy endpoints. Shell workspace context is derived
from `/api/v1/me` through a pure presenter.

Auth routes are introduced behind an injectable Fastify route adapter. The route
layer owns HTTP-only session cookie serialization, while token creation,
verification, session lookup, and magic-link sending remain inside the auth
service boundary.

Platform persistence lives in `packages/db` and is exposed to API modules
through repository adapters. The schema includes users, magic links, sessions,
organization memberships, organization invitations, projects, API keys, and
audit events. Organization pricing state stores only the selected
`organizations.plan_id`, while monthly counters are persisted in
`organization_monthly_usage` keyed by `organization_id + month_start`. Browser
onboarding dismissal state is persisted separately in
`user_organization_onboarding_states` keyed by `organization_id + user_id`,
while milestone completion stays derived from projects, API keys, invitations,
and audit events instead of being duplicated into its own status table.
API services must continue to depend on repository interfaces
rather than Drizzle directly.

Browser session principal resolution is separate from machine API-key auth.
`sessionAuthPlugin` resolves HttpOnly cookie sessions into `request.sessionUser`
for browser routes. The existing API-key auth plugin remains responsible for
machine ingestion routes and continues to set `request.apiKeyPrincipal`.
The `/me` response is composed through the platform context service and includes
user, membership, organization, project, onboarding, and current monthly
plan-usage context.

The web library baseline is Radix UI and shadcn-style local primitives for UI,
Zod-validated Fastify API clients, TanStack Table for data grids, Recharts for
dashboard charts, and custom Fastify magic-link/session auth. OpenAPI types
must be generated from `apps/api`'s `/api/v1/openapi.json`; `apps/web` must not
become a second API contract source.

### Platform Core vs Audit Product

Current `platform-core` responsibilities in this repo:

- browser session auth and magic-link flows
- users, organizations, memberships, and invitations
- workspace selection and current-user context
- onboarding framework, dismissal state, and generic progress summary shape
- API key management as a generic machine-credential admin flow
- shared dashboard shell, settings shell, and UI primitives

Current `audit-product` responsibilities in this repo:

- audit-event ingestion
- audit-event reads, stats, and timeseries
- event-specific empty states and event inspection UI
- generic monthly usage metering through `organization_monthly_usage.meter_key + quantity`
- audit-specific onboarding milestones such as `first_event_ingested`

Current `platform-extension` candidates that should stay generic when added:

- billing and subscriptions
- entitlements and generic usage meters
- background jobs and scheduling
- notifications and outbound webhooks
- exports and delivery infrastructure
- admin/support controls
- MFA, SSO, and enterprise auth controls

### Extraction Map

If this codebase later seeds a generic SaaS boilerplate, the intended split is:

Move to the future boilerplate repo:

- `apps/api/src/modules/auth/*`
- generic parts of `apps/api/src/modules/platform/*`
- generic parts of `apps/api/src/modules/api-keys/*`
- generic parts of `apps/web/src/features/auth/*`
- generic parts of `apps/web/src/features/organizations/*`
- generic parts of `apps/web/src/features/api-keys/*`
- `apps/web/src/features/onboarding/*` framework and shells
- shared UI primitives and API-client infrastructure
- reusable domain, config, db, and testkit utilities

Stay in the audit product repo:

- `apps/api/src/modules/audit-events/*`
- `apps/web/src/features/audit-events/*`
- audit-specific onboarding milestone definitions and milestone-to-step mapping
- audit-specific pricing or quota enforcement that assumes event volume is the primary meter

Needs refactor before extraction:

- onboarding UI copy and CTA targets, which still live inside the audit app and should move behind product-defined configuration if a second product is introduced

Recent progress toward extraction:

- `packages/domain/src/onboarding/*` now contains only generic step definitions, progress summarization, and dismissal handling
- `packages/domain/src/audit-events/onboarding.ts` owns the current audit-product milestone ids and raw milestone-to-step mapping
- `packages/db/src/schema/identity.ts` now models monthly usage as a generic meter row with `meter_key` and `quantity`
- the current audit product still consumes that meter model as the `events` meter for pricing and quota enforcement
