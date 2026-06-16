# Agent engineering rules

AuditTrail should be easy for AI agents to extend without silently weakening the architecture.

## API route rule

No API route should be added without tests.

The API test command enforces 95% coverage for lines, statements, branches, and functions:

```bash
pnpm --filter @auditrail/api test
```

Route tests should use Fastify `app.inject()` unless the behavior specifically requires a real network socket.

## Environment rule

API environment variables are validated with Zod before build and start:

```bash
pnpm --filter @auditrail/api validate:env
pnpm --filter @auditrail/api build
```

The validator reads root `.env`, then `apps/api/.env`, then process env. App-level values override root values.

Required API envs:

- `DATABASE_URL`
- `REDIS_URL`
- `API_KEY_PEPPER`
- `API_HOST`
- `API_PORT`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW`
- `NODE_ENV`

Defaults exist only for non-secret process settings. Service URLs must be explicit.

## Local ports

Postgres maps to host port `5433` by default to avoid conflicting with an existing local Postgres on `5432`.

Redis maps to host port `6379` by default.

## Shared package rule

Shared packages should stay narrow:

- `packages/config`: environment and config parsing helpers only
- `packages/domain`: pure schemas, types, and business helpers only
- `packages/db`: database schema, database client, migrations, and query helpers only
- `packages/testkit`: test helpers only

Do not put framework, database, queue, or filesystem access into `packages/domain`.
