# Project Anvil

Project Anvil is an AI-native framework for creating production-ready
platforms. The goal is to let a team go from an idea to a production-quality
platform in hours instead of months while keeping architecture strict,
generation deterministic, and product code cleanly separated from platform
code.

This repository currently contains two things at once:

- the Project Anvil framework-in-progress
- AuditTrail, the reference product used to prove the framework against a real
  platform

The direction comes from [docs/ultimate-goal.md](./docs/ultimate-goal.md): the
framework should eventually generate production-ready vertical slices instead
of partial boilerplate, and it should be optimized for both humans and AI
agents from day one.

## Vision

Project Anvil is intended to become more than a SaaS starter.

- open source first
- AI-first developer experience
- convention over configuration
- production-ready by default
- architecture enforced, not merely documented
- deterministic and reproducible generation
- small, composable building blocks
- product code separated from platform code
- regenerable artifacts with automatic validation

Long term, a developer should be able to describe a business problem or a
resource and let the framework generate the surrounding platform slice:

- database schema
- migrations
- repositories
- services
- validation
- API routes
- OpenAPI
- generated SDKs and frontend clients
- forms, tables, and detail pages
- tests
- documentation

## Current State

Today, Project Anvil already includes working terminal-first framework seams:

- an isolated `apps/landing` Astro marketing site for Project Anvil
- scaffold planning, generation, and smoke validation for new platform
  candidates
- resource spec initialization from the terminal
- resource planning, preview generation, repo-root install, and smoke checks
- deterministic SQL migration generation for supported generated resources
- generated Postgres CRUD repos for the current supported organization-owned
  resource slice
- AI-facing context and recipe commands for bounded implementation workflows

The live reference stack in this repo is still AuditTrail:

- Fastify API in `apps/api`
- Next.js app in `apps/web`
- worker runtime in `apps/worker`
- PostgreSQL with Drizzle schema and migrations
- platform features such as auth, organizations, API keys, billing, webhooks,
  and onboarding
- an AuditTrail-specific event ingest and investigation product layered on top

This means the repo is not yet a true multi-product runtime host. It is a
framework codebase plus a reference product proving the platform and generator
seams.

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
docker compose up -d postgres
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

Start the web app:

```bash
WEB_API_BASE_URL=http://localhost:4000 \
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 \
pnpm dev:web
```

Start the worker:

```bash
pnpm dev:worker
```

Start the landing site:

```bash
pnpm dev:landing
```

## Framework Commands

Project Anvil is currently driven from the terminal.

Scaffold a new platform candidate:

```bash
pnpm saas plan scaffold my-platform
pnpm saas generate scaffold my-platform --output .generated/scaffolds/my-platform
pnpm saas check scaffold my-platform
```

Create and install a generated resource:

```bash
pnpm saas init resource achievement --field title:string:required --field slug:string:required:unique
pnpm saas plan resource specs/achievement.json
pnpm saas add resource specs/achievement.json --output .generated/resource-preview/achievement
pnpm saas agent context resource specs/achievement.json
pnpm saas agent recipe resource-install specs/achievement.json
pnpm saas check generators
pnpm saas check generated-resource
pnpm saas apply resource specs/achievement.json --target .generated/apply-preview/achievement
pnpm saas install resource specs/achievement.json
```

Prove the committed generated-resource slice against Postgres:

```bash
pnpm saas check generators
pnpm saas check generated-resource
pnpm saas install resource tools/saas/__fixtures__/resources/customer.json --force
pnpm db:create:test
pnpm db:migrate:test
pnpm --filter @auditrail/api typecheck
pnpm --filter @auditrail/api exec vitest run src/modules/generated/customer/__tests__/routes.test.ts src/modules/generated/customer/__tests__/service.test.ts
pnpm --filter @auditrail/api exec vitest run --config vitest.integration.config.ts src/modules/generated/customer/__tests__/routes.integration.test.ts
```

The current proof resource is `customer`. It is already installed in this repo,
so rerunning the install step uses `--force` intentionally.

Health and tooling checks:

```bash
pnpm saas doctor
pnpm build:landing
pnpm release:dry-run
pnpm test:saas
pnpm typecheck:saas
pnpm verify
```

## GitHub Releases

Project Anvil now publishes repo-level GitHub prereleases automatically from
the `alpha` branch through `semantic-release`.

Current release posture:

- source branch: `main`
- prerelease branch: `alpha`
- channel: `alpha`
- tag format: `v<version>`
- no npm publish step yet
- no changelog commit-back step yet

The workflow creates Git tags and GitHub Releases only after `pnpm verify`
passes in CI on `alpha`.

Branch promotion:

- pushes to `main` automatically trigger a GitHub Action that merges `main`
  into `alpha`
- pushes to `alpha` then run the prerelease workflow
- if `main -> alpha` conflicts, the sync workflow fails and the conflict must
  be resolved explicitly on `alpha`

One-time branch bootstrap:

```bash
git checkout -b alpha
git push -u origin alpha
```

Commit format matters because release creation is commit-driven:

- `feat: ...` -> patch prerelease bump
- `fix: ...` -> patch prerelease bump
- `perf: ...` -> patch prerelease bump
- `refactor: ...` -> patch prerelease bump
- `feat!: ...` or `BREAKING CHANGE:` -> minor prerelease bump

Examples:

```text
feat: add project-module prerelease automation
fix: prevent webhook delivery retries from losing status
refactor: simplify platform entitlement resolver
feat!: change generated resource install contract
```

Local dry run:

```bash
pnpm install --no-frozen-lockfile
pnpm release:dry-run
```

`pnpm release:dry-run` still needs access to the configured GitHub remote, and
full GitHub-plugin verification is most reliable when `GITHUB_TOKEN` is set in
the shell.

Landing provenance:

- `apps/landing` now adapts the MIT-licensed upstream `Tailcast` Astro theme
- the landing has been reduced to a single Project Anvil marketing page
- it remains separate from the authenticated product runtime and should be
  deployed independently

## Verification

The current authoritative release and quality gate lives in
[docs/04-quality-gates.md](/Users/denistarasenko/Work/Projects/auditrail/docs/04-quality-gates.md:1).

Common commands:

```bash
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm test:saas
pnpm typecheck:saas
pnpm --filter @auditrail/api test:integration
pnpm --filter @auditrail/worker test
```

## Task Tracking

The `tasks/` directory is the repository-local task tracker used by agents.
Each category has its own `.txt` file with `Queue` and `Done` sections.

## Agent Quickstart

For low-context agent work, start with:

1. `AGENTS.md`
2. the relevant `tasks/*.txt` file
3. [docs/08-agent-quickstart.md](/Users/denistarasenko/Work/Projects/auditrail/docs/08-agent-quickstart.md:1)

## Deployment

See [docs/06-deployment.md](/Users/denistarasenko/Work/Projects/auditrail/docs/06-deployment.md:1)
for the current deployed stack and required env vars.

The current deployment reality is still the AuditTrail reference product:

- `web`
- `api`
- `worker`
- `postgres`

The API and worker containers still use source-runtime startup commands today.
Compiled-runtime hardening remains a later framework slice.

Operational procedures for backup, restore, secret rotation, migration
rollback, rate limiting, and incident handling are documented in
[docs/09-operations.md](./docs/09-operations.md).
