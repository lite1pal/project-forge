# AuditTrail

AuditTrail is a multi-tenant audit event platform for SaaS teams. The current build proves the core architecture: API-key authenticated ingestion, append-only event storage in Postgres, validated environment config, default API rate limiting, and strict test coverage gates.

## Current Capabilities

- Fastify API in `apps/api`
- Next.js app in `apps/web`
- Shared packages for config, domain schemas, database schema/client, and test helpers
- PostgreSQL and Redis through Docker Compose
- Drizzle schema and migrations
- API-key authenticated `POST /v1/events`
- Authenticated `GET /v1/events`
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

The API test command enforces coverage:

```bash
pnpm --filter @auditrail/api test
```

## API Examples

Health:

```bash
curl -i http://localhost:4000/health
```

Ingest an event:

```bash
curl -i http://localhost:4000/v1/events \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer atl_local_dev_key' \
  -d '{"event":"user.deleted","actor":"admin_123","target":"user_456","metadata":{"reason":"GDPR request"}}'
```

List recent events:

```bash
curl -i 'http://localhost:4000/v1/events?limit=25' \
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

