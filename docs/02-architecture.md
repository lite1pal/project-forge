# Architecture

AuditTrail uses a TypeScript monorepo with small deployable apps and narrow shared packages.

## Apps

`apps/api` owns HTTP behavior:

- request validation
- API key authentication
- rate limiting
- event ingestion
- event reads
- API-specific tests and coverage gates

`apps/web` owns the dashboard experience. It should call the API instead of importing API internals.

## Packages

`packages/domain` contains pure schemas and domain types. It must not import framework, database, filesystem, queue, or env code.

`packages/config` contains reusable config parsing helpers.

`packages/db` contains Drizzle schema, database client creation, migrations, and seed helpers.

`packages/testkit` contains reusable test helpers only.

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

## Current Event Flow

```text
Client
  -> Fastify rate limiter
  -> API key auth
  -> Zod payload validation
  -> Audit event service
  -> Postgres repo
  -> audit_events table
```

The read path uses the same API key principal to scope events to the authenticated project.

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
under `apps/web/src/lib`. Server data is owned by TanStack Query or server
component loaders, not by global client stores.

Protected browser screens must use the API-owned session model. Server
components forward the incoming HttpOnly session cookie to `apps/api`, and
client-side code may call browser-safe API endpoints with credentials included.
Do not expose ingestion or machine API keys through `NEXT_PUBLIC_*` variables.

The current audit-events vertical slice is server-loaded from `apps/api` and
renders URL-backed filters, cursor pagination, summary statistics, and
timeseries data. The frontend must keep this flow as a direct Fastify API
consumer and use `/api/v1/me` to protect browser sessions.

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

### Platform Modules

Production platform behavior starts in pure API modules before routes are added.
Custom auth lives under `apps/api/src/modules/auth`, organization/project
membership logic under `apps/api/src/modules/platform`, and async export job
logic under `apps/api/src/modules/exports`. These modules follow the same
pattern as audit events: Zod at boundaries, pure services, repository
interfaces, and tests before Fastify routes.

The web app mirrors those platform capabilities with feature boundaries under
`apps/web/src/features/auth`, `organizations`, `invitations`, and `exports`.
Web API clients, server loaders, and UI screens should be added only when the
corresponding Fastify API routes exist.

Auth routes are introduced behind an injectable Fastify route adapter. The route
layer owns HTTP-only session cookie serialization, while token creation,
verification, session lookup, and magic-link sending remain inside the auth
service boundary.

Platform persistence lives in `packages/db` and is exposed to API modules
through repository adapters. The schema includes users, magic links, sessions,
organization memberships, organization invitations, and export jobs. API services
must continue to depend on repository interfaces rather than Drizzle directly.

Browser session principal resolution is separate from machine API-key auth.
`sessionAuthPlugin` resolves HttpOnly cookie sessions into `request.sessionUser`
for browser routes. The existing API-key auth plugin remains responsible for
machine ingestion routes and continues to set `request.apiKeyPrincipal`.
The `/me` response is composed through the platform context service and includes
user, membership, organization, and project context.

The web library baseline is Radix UI and shadcn-style local primitives for UI,
React Hook Form and Zod for forms, TanStack Query for API cache ownership,
TanStack Table for data grids, Recharts for dashboard charts, `nuqs` for URL
state, Zustand only for shared UI state, custom Fastify magic-link/session auth,
`next-intl` for i18n, Sentry for monitoring, and PostHog for product analytics.
OpenAPI types must be generated from `apps/api`'s `/api/v1/openapi.json`;
`apps/web` must not become a second API contract source.
