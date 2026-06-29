# Quality Gates

AuditTrail should be difficult to extend without tests.

## Required Checks

Run:

```bash
pnpm verify
```

This runs:

```bash
pnpm check:boundaries
pnpm typecheck
pnpm test
```

`pnpm check:boundaries` fails fast when `platform-core` or
`platform-extension` code imports `audit-product` code, or when generic domain
paths reach into `packages/domain/src/audit-events/**`.

`pnpm test` is the fast unit and route-behavior gate. It excludes integration tests and enforces the API coverage threshold.

For the real DB/auth path, also run:

```bash
pnpm db:create:test
pnpm db:migrate:test
pnpm --filter @auditrail/api test:integration
```

`TEST_DATABASE_URL` must point to a separate database. Integration tests truncate and reseed their database on each run and must never share the same database as local development.
When a workflow now records durable outbox intent, integration coverage should
assert both the primary write and the expected `job_outbox` side effect for the
success and failure paths that matter.

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

When app-level runtime behavior changes, add focused `buildApp()` or plugin
tests for that seam as part of the same change. The current request-runtime
path is the example: tests assert `x-request-id` generation or reuse plus the
structured completion log fields without leaking auth headers, cookies, API
keys, or request bodies.
The centralized error-policy seam follows the same rule: tests must cover the
production-safe unknown-error response, the non-production debug path, and
compatibility for existing validation, auth, quota, and rate-limit responses.

Use `app.inject()` for route tests unless a real network socket is required.
When adding new persistence adapters for public credential or auth workflows,
add repo tests as part of the same change so the coverage gate does not rely
only on route behavior.

## Test Layout

Unit and route tests are colocated with source files under local `__tests__` directories.
Integration tests use the `.integration.test.ts` suffix and are discovered separately.
Persistence adapters that rely on database-specific locking or transaction
behavior should prefer this path even when the public runtime integration does
not exist yet. The generic jobs outbox repo is the current example: its
claim/retry semantics are verified directly against Postgres instead of only
through unit doubles. The same rule applies to future platform billing
persistence adapters because uniqueness, upsert, and organization-isolation
behavior depend on the real database.

Current integration discovery pattern:

```text
src/**/__tests__/**/*.integration.test.ts
```

Preferred test placement:

- source-adjacent unit tests in `__tests__`
- route tests next to their module
- integration tests next to their module with `.integration.test.ts`

Pure internal support-role helpers in `packages/domain` must have unit tests
alongside any role-model changes. The product-route authorization tests should
continue to prove that organization membership checks stay unchanged and that
support access does not become an implicit bypass.

Support lookup routes must include route tests for authentication, support-only
authorization, constrained queries, and safe response shapes. The support
module should not expose secrets, raw audit payloads, or customer write
capabilities.

New public API routes should register under the current versioned prefix, currently `/api/v1`.
Do not move operational health checks away from unversioned `/health`.

## Web Quality Gates

The web app must enforce the frontend architecture before changes are complete:

- no `app/**/route.ts` files
- no `pages/api/**` files
- no relative local imports inside `apps/web`; use `@/...` instead
- feature components under `apps/web/src/features/**/components` stay under 120 lines
- feature components cannot import `api`, `server`, `services`, or `state`
- client files cannot import server-only modules
- pure domain modules are unit tested
- feature services are integration tested with fake clients or injected stubs
- global CSS contains only Tailwind import, tokens, reset, and base styles

Required web verification commands are:

```bash
pnpm --filter web check:architecture
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web test:ui
```

`pnpm --filter web test:ui` is the coverage-enforced UI gate for the current
dashboard, settings, members, and shell slice. It requires at least 90% for:

- statements
- branches
- functions
- lines

The scope is intentionally limited to the UI-facing files added in this slice,
because the broader web app still contains older unscoped server and API helpers
that are not yet under the same coverage standard.

## Worker Quality Gates

The worker app is a generic runtime boundary and must stay free of
`audit-product` imports. Until a real processing loop exists, the required
worker checks are focused on config parsing, startup/shutdown behavior, and the
handler registry:

```bash
pnpm --filter @auditrail/worker typecheck
pnpm --filter @auditrail/worker test
```

## Framework Contract Gates

The `@auditrail/framework` package is pure contract vocabulary for future
tooling and must stay generic and audit-free. Its focused checks are:

```bash
pnpm --filter @auditrail/framework typecheck
pnpm --filter @auditrail/framework test
```

When schemas are added there, keep validation coverage focused on accepted
generic definitions plus invalid enum, ownership, reserved-name, duplicate-
field, CRUD-disablement, and API-prefix rejection paths.

The first repo-local framework CLI health check is:

```bash
pnpm saas doctor
```

It is deterministic, local-only, and safe for CI. It checks that the current
boundary, extraction, placeholder-validation, framework-contract, product
definition, and quality-gate seams are still wired as expected before deeper
tooling is added.

## Platform Module Gates

Platform modules must land in this order:

1. pure service/domain modules with unit tests
2. repository implementations with integration tests
3. Fastify routes with `app.inject()` tests and required coverage
4. web API clients/loaders/components consuming those routes

## Boundary Verification

The boundary rule is directional:

- `platform-core` may depend on platform code, but not `audit-product`
- `platform-extension` may depend on platform code, but not `audit-product`
- `audit-product` may depend on platform modules

The enforced rule map is exposed at:

```text
tools/architecture-boundaries/rules.ts
```

Run the scanner directly with:

```bash
pnpm check:boundaries
```

## Tooling Manifest Validation

The extraction manifest is non-runtime tooling metadata. Validate it directly with:

```bash
pnpm check:extraction-manifest
```

This check verifies only manifest structure and section-action consistency. It
does not perform extraction, file copying, or repo mutation.

For the repo-tree dry-run extraction plan, run:

```bash
pnpm check:extraction
pnpm test:extraction
```

`pnpm check:extraction` validates the current tree against the advisory
manifest and fails closed on unknown tracked files, unmatched required entries,
conflicting primary actions, or product-code leaks into the copy set. It is a
focused tooling check and is not part of `pnpm verify` yet.

For a local candidate output directory, run:

```bash
pnpm extract:boilerplate
pnpm check:extraction:placeholder
```

`pnpm check:extraction:placeholder` is the focused scaffold-validation gate for
the current extraction work. It regenerates the ignored local candidate output,
applies a tiny placeholder product fixture, and fails if the generated
candidate is missing required generic scaffold files or if the placeholder
wiring imports AuditTrail-specific modules. It is still local-only validation:
it does not typecheck or build the generated candidate as an independent
published boilerplate yet.

This command is also outside `pnpm verify`. It reuses the same fail-closed
planner and writes only to ignored repo-local output such as
`.generated/saas-boilerplate/`.
