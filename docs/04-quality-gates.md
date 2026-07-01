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
The ingest path is the concrete baseline: success should prove event write plus
monthly usage update plus outbox enqueue, while validation, auth, revoked-key,
quota, and rate-limit failures should prove that no extra write or enqueue
side effect escaped.
Project webhook changes follow the same rule: cover the management routes, the
ingest-side delivery enqueue path, and the worker delivery behavior together
instead of relying on one layer alone.
Generated-resource tooling follows the same principle for its supported slice:
when the generator starts emitting runtime-ready repo code, the fast tooling
checks should prove golden-fixture parity, smoke validation, and type-safe
template output together instead of relying only on string-level unit tests.

## Hosted Runtime Release Gate

The hosted runtime release gate is broader than the fast `pnpm verify` loop.
Run these commands from the repository root before treating the hosted flow as
ready for release:

```bash
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm db:create:test
pnpm db:migrate:test
pnpm --filter @auditrail/api test:integration
pnpm --filter web check:architecture
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web test:ui
pnpm --filter @auditrail/worker typecheck
pnpm --filter @auditrail/worker test
pnpm build:web:container
docker compose -f docker-compose.coolify.yml up --build
```

The deployed runtime now includes `web + api + worker + postgres`. Worker
checks now prove the real outbox polling loop and handler dispatch path, not
just config parsing and idle startup.

The landing app is intentionally outside that hosted runtime gate today. It is
marketing-only, not part of the signed-in product flow, and should be checked
independently with:

```bash
pnpm --filter landing typecheck
pnpm --filter landing build
```

## GitHub Prerelease Gate

The repo now has one automated GitHub prerelease lane under
`.github/workflows/release.yml`.

Current policy:

- `main` is the source branch for ongoing development
- direct pushes to `alpha` publish the current GitHub prerelease stream automatically
- pushes to `main` first trigger the `sync-alpha` workflow, which merges
  `main` into `alpha`
- successful `sync-alpha` completion also triggers the release workflow
- the release lane runs `pnpm verify` before tagging
- successful publishes create Git tags and GitHub prereleases only
- the current channel is `alpha`
- the workflow does not publish npm packages or push changelog commits yet

Before relying on the CI workflow for a structural release change, validate
the semantic-release decision locally:

```bash
pnpm install --no-frozen-lockfile
pnpm release:dry-run
```

This dry run still needs network access to the configured Git remote. For the
closest match to CI, export a GitHub token in the shell before running it.

Release creation is commit-driven. At the current 0.x framework stage:

- `feat`, `fix`, `perf`, and `refactor` trigger patch prerelease bumps
- breaking changes trigger minor prerelease bumps
- commits such as `docs`, `test`, or `chore` do not publish by themselves

The sync policy is intentionally strict. If the automated `main -> alpha`
merge conflicts, the workflow should fail and a human should resolve the
branch divergence explicitly instead of letting CI guess.

The release trigger is intentionally dual-mode because GitHub suppresses
downstream `push` workflow runs when the upstream branch update was created by
another workflow using the default `GITHUB_TOKEN`. The repo therefore listens
for successful `Sync Alpha` workflow completion in addition to direct `alpha`
pushes, and the release job checks out `alpha` explicitly before running
`semantic-release`.

The focused SaaS tooling test lane should be isolated from generated preview
output:

```bash
pnpm test:saas
```

That script now excludes `.generated/**` so temporary scaffold previews or
resource previews do not pollute the committed tooling suite.

## API Coverage

Project policy requires at least 95% coverage for:

- statements
- branches
- functions
- lines

Coverage is focused on API behavior and route/runtime code. Infrastructure adapters that require external services are excluded from the fast unit coverage gate and should receive explicit integration tests when they become critical.

Known gap as of 2026-06-30:

- `apps/api/vitest.config.ts` still enforces `90` for statements, branches,
  functions, and lines
- the current `pnpm test` run passed with `apps/api` coverage at `93.46%`
  statements, `90.14%` branches, `95.76%` functions, and `93.64%` lines
- do not treat the 95% policy as satisfied until the Vitest thresholds are
  raised and the suite stays green at that level

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
`audit-product` imports. The required worker checks cover config parsing,
outbox polling lifecycle, handler dispatch, retry behavior, graceful
shutdown, and the concrete webhook-signing or delivery helpers that the
registered handlers use:

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

The current read-only SaaS tooling checks are:

```bash
pnpm typecheck:saas
pnpm test:saas
pnpm saas init resource achievement --field title:string:required --field slug:string:required:unique
pnpm saas plan resource tools/saas/examples/customer.resource.json
```

`pnpm saas init resource ...` writes a validated JSON resource spec inside the
repo so resource creation can start entirely from the terminal. It stays
deterministic and fail-closed:

- it reuses the canonical framework resource schema for normalization and validation
- it requires one or more repeated `--field <name:type[:modifier...]>` flags
- it defaults to `specs/<resource>.json` and fails on unsafe output paths or accidental overwrites without `--force`
- it keeps defaults aligned with the current generator path, including organization-owned API prefixes and `ui.nav: false`

`pnpm saas plan resource ...` validates a JSON resource spec and prints a
deterministic dry-run file plan only. It must not write CRUD files or mutate
runtime code.

The first write-capable generator check is now:

```bash
pnpm saas add resource tools/saas/__fixtures__/resources/customer.json --output .generated/resource-preview/customer
```

The generator must stay fail-closed:

- it validates the spec through the canonical framework schema
- it reuses the dry-run planner before writing preview files
- it supports one narrow organization-owned subset only
- it writes under `.generated/` or `tmp/`, not real app source
- it fails on unsupported ownership, unsupported field types, blocking planner issues, or existing target files unless `--force` is passed

The first AI-agent workflow check is now:

```bash
pnpm saas agent context resource tools/saas/__fixtures__/resources/customer.json
```

The agent-context command must stay deterministic and concise:

- it validates through the canonical resource schema
- it reuses the dry-run planner instead of scanning the repo broadly
- it emits paths, checks, stop conditions, and generator limits instead of large copied doc contents
- optional output files must stay under `.generated/` or `tmp/`

The first full generated-resource AI install recipe check is now:

```bash
pnpm saas agent recipe resource-install tools/saas/__fixtures__/resources/customer.json
```

The recipe command must stay deterministic and concise:

- it validates the resource spec before emitting a recipe
- it reuses the planner, existing agent-context metadata, smoke-check guidance, and safe apply guidance
- it emits exact commands, allowed paths, forbidden paths, stop conditions, required checks, and report format for one resource only
- markdown is the default output mode and `--json` is available for stable future machine consumption
- optional output files must stay under `.generated/` or `tmp/`
- it does not add new CRUD generation behavior or mutate runtime source

The first create-app scaffold planning check is now:

```bash
pnpm saas plan scaffold my-saas-app
```

The scaffold planner must stay deterministic and planning-only:

- it validates app name, supported options, and target directory safety before emitting a plan
- it reuses extraction dry-run metadata and placeholder-product metadata instead of generating scaffold output
- it emits source, identity, product-setup, runtime-config, quality-gate, and AI-workflow groups
- markdown is the default output mode and `--json` is available for stable future machine consumption
- it does not create files, publish a package, create a repo, or mutate runtime source

The first local scaffold generation check is now:

```bash
pnpm saas generate scaffold my-saas-app --output .generated/scaffolds/my-saas-app
```

The scaffold generator must stay deterministic and fail-closed:

- it reuses the scaffold planner before writing
- it stages extraction output plus placeholder-product files instead of duplicating classification logic
- it writes only to safe local targets under `.generated/` or `tmp/`
- it writes a generated README plus `.saas/scaffold-report.json`
- it fails on unsafe output paths, unsupported options, blocking planner warnings, forbidden AuditTrail imports, unresolved placeholders, or unsafe overwrite attempts
- `--force` may clean only prior generated-owned scaffold output for the same app

The scaffold smoke validation check is now:

```bash
pnpm saas check scaffold my-saas-app
```

It must stay deterministic and isolated:

- it reuses the scaffold generator and validates its actual output instead of inventing a parallel scaffold path
- it generates repeated scaffold output only under ignored temp directories
- it fails on missing required scaffold files, forbidden AuditTrail imports, unresolved placeholders, generated file-set drift, or real-source mutation
- it confirms repeated generation is deterministic after normalizing output-path-specific README and report fields
- it cleans up temp scaffold output after the check

The generated-resource smoke check is now:

```bash
pnpm saas check generated-resource
```

It is deterministic, local-only, and safe for CI. It validates the current
fixture resource in isolated temp output by checking:

- planner-aligned generated file paths only
- parity with committed golden fixture output
- expected domain, DB, API, web, test, and customization-doc file groups
- no forbidden AuditTrail-specific imports in generated files
- no unresolved template placeholders that should have been rendered
- deterministic repeated generation
- syntax-readiness for generated `.ts` and `.tsx` files via lightweight parse or transpile diagnostics

What this smoke check does not prove by itself:

- it does not prove that repo-root installation is safe for every future
  runtime composition shape
- it does not register API routes, web routes, DB schema barrels, nav entries, or exports
- it does not prove the generated migration itself has been applied successfully to a real database
- it does not run a full standalone typecheck or build for the isolated output

The first opt-in apply path is now:

```bash
pnpm saas apply resource tools/saas/__fixtures__/resources/customer.json --target .generated/apply-preview/customer
```

The first repo-root install path is now:

```bash
pnpm saas install resource tools/saas/__fixtures__/resources/customer.json
```

The current release-quality generated-resource proof is now the committed
`customer` slice. From the repo root, the full proof path is:

```bash
pnpm saas init resource achievement --field title:string:required --field slug:string:required:unique
pnpm saas plan resource specs/achievement.json
pnpm saas add resource specs/achievement.json --output .generated/resource-preview/achievement
pnpm saas check generators
pnpm saas check generated-resource
pnpm saas install resource tools/saas/__fixtures__/resources/customer.json --force
pnpm db:create:test
pnpm db:migrate:test
pnpm --filter @auditrail/api typecheck
pnpm --filter @auditrail/api exec vitest run src/modules/generated/customer/__tests__/routes.test.ts src/modules/generated/customer/__tests__/service.test.ts
pnpm --filter @auditrail/api exec vitest run --config vitest.integration.config.ts src/modules/generated/customer/__tests__/routes.integration.test.ts
```

What this proof now covers:

- deterministic resource init, plan, preview generation, golden-fixture drift detection, and isolated smoke validation
- repo-root install through supported seams only: generated files, domain barrel, DB schema barrel, migration journal, and `apps/api/src/app.ts`
- generated route auth and organization-access policy in unit tests
- generated API module type safety through `pnpm --filter @auditrail/api typecheck`
- real Postgres migration plus route execution through the installed
  `customer` integration test

Operator note:

- the committed proof resource is already installed in this repo, so rerunning
  the install step uses `--force` intentionally

Current apply policy:

- preview mode remains the default through `pnpm saas add resource ... --output ...`
- apply mode is explicit and target-scoped
- repo-root install is explicit and reuses the same planner, generator, and validation flow
- apply reuses the generator plus smoke validation before writing
- apply and install may patch only deterministic central files in the current slice
- apply and install now emit a deterministic SQL migration and Drizzle journal update for the supported resource slice
- root install currently supports one explicit `apps/api/src/app.ts` registration seam
- unsupported or ambiguous central runtime files must fail closed before writes

`test:saas` now covers apply-mode safety and isolated-target behavior. The
apply or install commands are not part of `pnpm verify` as repo-root mutation
steps.

The generator stability check is now:

```bash
pnpm saas check generators
```

The golden-fixture check must stay deterministic:

- it generates fixture resources into a safe temp directory only
- it compares file paths and file contents against committed golden fixtures
- it fails on missing files, extra files, and content drift
- `--update` is explicit and refreshes committed fixture directories only

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
