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

## API Coverage

The API enforces at least 95% coverage for:

- statements
- branches
- functions
- lines

Coverage is focused on API behavior and route/runtime code. Infrastructure adapters that require external services are excluded from the fast unit coverage gate and should receive explicit integration tests when they become critical.

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

## Adding API Routes

Every API route must include tests for:

- success response
- validation failure
- authentication behavior when protected
- relevant rate-limit behavior if route-specific behavior differs from default

Use `app.inject()` for route tests unless a real network socket is required.

