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

