# AuditTrail foundation

Date: 2026-06-16

AuditTrail should demonstrate architecture without becoming architecture theater. The first build should prove a clean event ingestion path, tenant isolation, immutable storage, background work, and a useful dashboard with the fewest moving parts that still map to real production concerns.

## Product boundary

AuditTrail is a multi-tenant audit event platform for SaaS teams.

The first credible slice is:

- create an organization and project
- create and revoke API keys
- ingest events through a public API
- store events append-only in Postgres
- search and inspect audit events in a dashboard
- enqueue webhook/export work after ingestion
- process webhook deliveries in a worker
- export filtered events as CSV

## Stack

Use a TypeScript monorepo with small deployable apps and shared packages.

- Runtime: Node.js LTS
- Package manager: pnpm workspaces
- Build orchestration: Turborepo, only for workspace task running and caching
- Language: TypeScript
- Web app: Next.js
- API: Fastify
- Worker: BullMQ worker process
- Database: PostgreSQL
- Database access: Drizzle ORM and Drizzle Kit
- Queue: Redis with BullMQ
- Validation: Zod
- Tests: Vitest for unit/integration tests, Playwright for browser flows
- Local infrastructure: Docker Compose for Postgres and Redis
- Formatting/linting: Prettier and ESLint

Do not add ClickHouse, full RBAC, billing, SSO, a published SDK, or Kubernetes in the first pass. They are good discussion points later, but they dilute the first architecture proof.

## Why this shape

Next.js should own the user interface, route-level rendering, and dashboard ergonomics.

Fastify should own the public API, tenant-aware business operations, authentication, ingestion, and query endpoints. Keeping it separate from the web app makes the ingestion service explicit and easy to test.

The worker should own all asynchronous side effects: webhook delivery, retries, export generation, and later hash-chain verification jobs. It must be independently runnable so the background system is visible in the architecture.

Drizzle keeps the data layer close to SQL while still giving typed schema and migrations. This is a better fit than a heavy ORM for an audit-log product where schema, indexes, and query behavior are part of the showcase.

## Install order

1. Initialize repository hygiene:
   - `git init`
   - `.gitignore`
   - `.editorconfig`
   - `README.md`

2. Initialize workspace:
   - `package.json`
   - `pnpm-workspace.yaml`
   - `turbo.json`
   - root `tsconfig.base.json`
   - root ESLint and Prettier config

3. Install dev foundation:
   - `typescript`
   - `tsx`
   - `vitest`
   - `eslint`
   - `prettier`
   - `turbo`

4. Create shared packages before apps:
   - `packages/config`
   - `packages/domain`
   - `packages/db`
   - `packages/queue`
   - `packages/testkit`

5. Create deployable apps:
   - `apps/api`
   - `apps/worker`
   - `apps/web`

6. Add infrastructure:
   - `docker-compose.yml`
   - Postgres service
   - Redis service
   - `.env.example`

7. Add app dependencies:
   - API: `fastify`, `@fastify/cors`, `@fastify/cookie`, `zod`
   - Web: `next`, `react`, `react-dom`
   - DB: `drizzle-orm`, `drizzle-kit`, `pg`
   - Queue: `bullmq`, `ioredis`
   - Security: `argon2`, `nanoid`

8. Add browser testing only after the first UI route exists:
   - `@playwright/test`

## Directory structure

```text
auditrail/
  apps/
    api/
      src/
        modules/
          auth/
          organizations/
          projects/
          api-keys/
          audit-events/
          webhooks/
          exports/
        plugins/
        server.ts
      test/
    web/
      app/
      src/
        features/
        components/
        lib/
      test/
    worker/
      src/
        jobs/
        processors/
        worker.ts
      test/
  packages/
    config/
      src/
    db/
      src/
        schema/
        migrations/
        client.ts
    domain/
      src/
        audit-events/
        api-keys/
        tenants/
    queue/
      src/
    testkit/
      src/
  docs/
  docker-compose.yml
  pnpm-workspace.yaml
  turbo.json
```

## Package responsibilities

`packages/domain` contains pure business types, Zod schemas, value helpers, and functions with no database, network, framework, or environment access.

`packages/db` contains schema definitions, migrations, query helpers, and transaction helpers. It may depend on `domain`, but `domain` must never depend on `db`.

`packages/queue` contains queue names, job payload schemas, job producers, and worker registration helpers. Job processors live in `apps/worker`.

`packages/config` contains environment parsing. Apps import parsed config; packages should avoid reading `process.env` directly.

`packages/testkit` contains factories, fake clocks, test database helpers, and reusable integration setup.

## Module rule

Every API module should stay tiny:

```text
module/
  routes.ts
  service.ts
  repo.ts
  schema.ts
  service.test.ts
```

- `routes.ts` maps HTTP to validated inputs and outputs.
- `service.ts` owns business decisions.
- `repo.ts` owns database queries.
- `schema.ts` owns request/response validation.
- tests target services first, routes second.

## First build slice

The first build slice is now implemented:

1. `POST /v1/events`
2. API key authentication
3. event payload validation
4. append event to Postgres
5. `GET /v1/events` lists recent project events

The next slice should add either dashboard UI or queue handoff, but not both at the same time.
