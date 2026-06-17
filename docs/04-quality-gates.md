# Quality Gates

AuditTrail should be difficult to extend without tests.

## Required Checks

Run:

```bash
pnpm verify
```

This runs:

```bash
pnpm typecheck
pnpm test
```

`pnpm test` is the fast unit and route-behavior gate. It excludes integration tests and enforces the API coverage threshold.

For the real DB/auth path, also run:

```bash
pnpm db:create:test
pnpm db:migrate:test
pnpm --filter @auditrail/api test:integration
```

`TEST_DATABASE_URL` must point to a separate database. Integration tests truncate and reseed their database on each run and must never share the same database as local development.

## API Coverage

The API enforces at least 95% coverage for:

- statements
- branches
- functions
- lines

Coverage is focused on API behavior and route/runtime code. Infrastructure adapters that require external services are excluded from the fast unit coverage gate and should receive explicit integration tests when they become critical.

## Test Isolation

Do not couple unit tests through shared `process.env` mutation when the same configuration can be passed as an explicit option.

Preferred order for test control:

1. inject service or repo doubles
2. pass explicit app or plugin options
3. use env overrides only when the code path itself is specifically about env loading

This keeps parallel Vitest execution deterministic.

## Type Safety Rule

When registering Fastify plugins, do not pass `undefined` as the options argument. If a plugin has optional options, branch at the call site and register without the second argument when no options are present.

## Environment Validation

The API validates env before build and start.

Required service/security values:

- `DATABASE_URL`
- `REDIS_URL`
- `API_KEY_PEPPER`

Runtime defaults exist for:

- `NODE_ENV`
- `API_HOST`
- `API_PORT`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW`

## API Contract

The API contract is generated from route schemas and exposed at:

```text
GET /api/v1/openapi.json
```

Any change to request or response shapes should be made in the route schema and route tests together.
Do not maintain a separate hand-written API spec that can drift from the server.

## Adding API Routes

Every API route must include tests for:

- success response
- validation failure
- authentication behavior when protected
- relevant rate-limit behavior if route-specific behavior differs from default

Use `app.inject()` for route tests unless a real network socket is required.

## Test Layout

Unit and route tests are colocated with source files under local `__tests__` directories.
Integration tests use the `.integration.test.ts` suffix and are discovered separately.

Current integration discovery pattern:

```text
src/**/__tests__/**/*.integration.test.ts
```

Preferred test placement:

- source-adjacent unit tests in `__tests__`
- route tests next to their module
- integration tests next to their module with `.integration.test.ts`

New public API routes should register under the current versioned prefix, currently `/api/v1`.
Do not move operational health checks away from unversioned `/health`.
