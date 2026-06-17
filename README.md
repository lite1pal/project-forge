# AuditTrail

AuditTrail is a multi-tenant audit event platform for SaaS teams. The current build proves the core architecture: API-key authenticated ingestion, append-only event storage in Postgres, validated environment config, default API rate limiting, and strict test coverage gates.

## Current Capabilities

- Fastify API in `apps/api`
- Next.js app in `apps/web`
- Shared packages for config, domain schemas, database schema/client, and test helpers
- PostgreSQL and Redis through Docker Compose
- Drizzle schema and migrations
- API-key authenticated `POST /api/v1/events`
- Authenticated `GET /api/v1/events`
- Global API rate limiting, with `/health` exempt
- API test coverage threshold of 95%

## Local Setup

Install dependencies:

```bash
pnpm install --no-frozen-lockfile
```

Create local env:

```bash
cp .env.example .env
```

Start infrastructure:

```bash
docker compose up -d postgres redis
```

Generate and apply migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

For integration tests, use a separate database and migrate it independently:

```bash
pnpm db:create:test
pnpm db:migrate:test
```

Seed demo data:

```bash
pnpm db:seed
```

Start the API:

```bash
pnpm dev:api
```

## Verification

Run all checks:

```bash
pnpm verify
```

Or separately:

```bash
pnpm typecheck
pnpm test
```

Integration tests use `TEST_DATABASE_URL` and must not point at the same database as `DATABASE_URL`:

```bash
pnpm --filter @auditrail/api test:integration
```

The API test command enforces coverage:

```bash
pnpm --filter @auditrail/api test
```

## Deploying

For Coolify deployment, the repo now includes:

- a root `Dockerfile` for the API container
- `docker-compose.coolify.yml` for a single Coolify stack containing `api`, `postgres`, and `redis`

See [docs/06-deployment.md](/Users/denistarasenko/Work/Projects/auditrail/docs/06-deployment.md:1) for the required env vars and the stack setup.

## API Examples

Health:

```bash
curl -i http://localhost:4000/health
```

API descriptor:

```bash
curl -i http://localhost:4000/api
```

OpenAPI document:

```bash
curl -i http://localhost:4000/api/v1/openapi.json
```

Ingest an event:

```bash
curl -i http://localhost:4000/api/v1/events \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer atl_local_dev_key' \
  -d '{"event":"user.deleted","actor":"admin_123","target":"user_456","metadata":{"reason":"GDPR request"}}'
```

List recent events:

```bash
curl -i 'http://localhost:4000/api/v1/events?limit=25' \
  -H 'authorization: Bearer atl_local_dev_key'
```

Filter events:

```bash
curl -i 'http://localhost:4000/api/v1/events?event=user.deleted&actor=admin_123&from=2026-06-16T12:00:00.000Z&to=2026-06-16T13:00:00.000Z' \
  -H 'authorization: Bearer atl_local_dev_key'
```

Paginate and use multi-value filters:

```bash
curl -i 'http://localhost:4000/api/v1/events?limit=2&events=user.deleted,role.changed&actors=admin_123,service_456' \
  -H 'authorization: Bearer atl_local_dev_key'
```

Continue to the next page:

```bash
curl -i 'http://localhost:4000/api/v1/events?limit=2&cursor=<nextCursor>' \
  -H 'authorization: Bearer atl_local_dev_key'
```

Get summary stats:

```bash
curl -i 'http://localhost:4000/api/v1/events/stats?top=5&from=2026-06-16T12:00:00.000Z&to=2026-06-16T13:00:00.000Z' \
  -H 'authorization: Bearer atl_local_dev_key'
```

## Project Rules

Read `AGENTS.md` before making changes. The important constraints are:

- agents must not run shell commands directly
- all command execution is handed to the user
- API routes require tests
- API source coverage must stay at or above 95%
- env is validated before API build/start
- shared packages must stay narrow
- tests must prefer injected options over shared env mutation

## Test Layout

Tests are colocated with the code they cover under local `__tests__` directories instead of one shared top-level test bucket.

Examples:

- `apps/api/src/__tests__`
- `apps/api/src/modules/audit-events/__tests__`
- `packages/config/src/__tests__`

## Versioning

- The only supported API base path is `/api/v1`
- `/health` is unversioned for infrastructure checks
- Breaking API changes must land in a new version path
- Do not silently repurpose existing request or response fields on `/api/v1`

## Web App

`apps/web` is a Next.js UI for the existing Fastify API in `apps/api`.
It must not define Next.js route handlers, `pages/api` endpoints, or proxy API
routes. Configure explicit API URLs before running the app:

```bash
WEB_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
WEB_API_KEY=replace-with-a-local-api-key
```

Useful web commands:

```bash
pnpm --filter web check:architecture
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web dev
```

Refresh web API contract types after changing `apps/api` contracts:

```bash
pnpm --filter web api:types
```

The initial web event stream supports URL-backed filters, cursor pagination,
event totals, top event types, and a timeseries chart using the existing
`apps/api` endpoints. Full browser-session authentication still requires an API
principal mapping for organization and project ownership before replacing the
server-only local `WEB_API_KEY` path.

The web UI system is Tailwind-first. Shared primitives live in
`apps/web/src/components/ui`, feature components compose those primitives, and
`apps/web/app/globals.css` should stay limited to Tailwind import, semantic
tokens, reset, and base styles.

Production platform work is staged behind tested API modules. Custom auth,
organizations, invitations, and exports start as pure `apps/api` services with
repository interfaces and unit tests; Fastify routes should be added only with
route tests and docs in the same change.
