# AuditTrail

AuditTrail is a multi-tenant audit event platform for SaaS teams. The current MVP is a narrow hosted pilot: sign in, create an organization and project, generate an API key, ingest events, and inspect them in the dashboard.

## Current Capabilities

- Fastify API in `apps/api`
- Next.js app in `apps/web`
- Worker runtime in `apps/worker` that drains durable outbox jobs
- Shared packages for config, domain schemas, database schema/client, and test helpers
- PostgreSQL through Docker Compose
- Drizzle schema and migrations
- API-key authenticated `POST /api/v1/events`
- Authenticated `GET /api/v1/events`
- Browser-authenticated project API key management
- Browser-authenticated project webhook management with signed outbound delivery
- A dedicated `/getting-started` onboarding flow driven by derived workspace milestones
- Organization-scoped pricing plans with monthly included-event quotas
- Global API rate limiting, with `/health` exempt
- API coverage policy target of 95%, with current enforcement drift tracked in
  `docs/04-quality-gates.md`

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

`pnpm db:seed` creates the demo organization and project only. Protected API
routes require an API key created from the dashboard settings flow.

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

## Verification

For the hosted runtime release gate, use the command list in
[docs/04-quality-gates.md](/Users/denistarasenko/Work/Projects/auditrail/docs/04-quality-gates.md:1).
That is the authoritative automated gate for the current hosted stack.

Framework and scaffold tooling checks still exist, but they are not the active
hosted-MVP release gate:

```bash
pnpm saas doctor
pnpm saas plan scaffold my-saas-app
pnpm saas generate scaffold my-saas-app --output .generated/scaffolds/my-saas-app
pnpm saas check scaffold my-saas-app
pnpm saas plan resource tools/saas/__fixtures__/resources/customer.json
pnpm saas add resource tools/saas/__fixtures__/resources/customer.json --output .generated/resource-preview/customer
pnpm saas agent context resource tools/saas/__fixtures__/resources/customer.json
pnpm saas agent recipe resource-install tools/saas/__fixtures__/resources/customer.json
pnpm saas check generators
pnpm saas check generated-resource
pnpm saas apply resource tools/saas/__fixtures__/resources/customer.json --target .generated/apply-preview/customer
pnpm saas install resource tools/saas/__fixtures__/resources/customer.json
pnpm verify
```

Or separately:

```bash
pnpm test:saas
pnpm typecheck:saas
pnpm --filter @auditrail/worker typecheck
pnpm --filter @auditrail/worker test
pnpm typecheck
pnpm test
```

Integration tests use `TEST_DATABASE_URL` and must not point at the same database as `DATABASE_URL`:

```bash
pnpm --filter @auditrail/api test:integration
```

The API test command reports coverage and enforces the current configured threshold:

```bash
pnpm --filter @auditrail/api test
```

Run the worker locally with:

```bash
pnpm dev:worker
```

Project webhook delivery depends on the worker. If you configure a webhook
endpoint from the settings UI, keep `pnpm dev:worker` running so signed
deliveries drain from the durable outbox.

## Task Tracking

The `tasks/` directory is the repository-local task tracker used by agents.
Each category has its own `.txt` file with `Queue` and `Done` sections.

## Agent Quickstart

For low-context agent work, start with:

1. `AGENTS.md`
2. the relevant `tasks/*.txt` file
3. [docs/08-agent-quickstart.md](/Users/denistarasenko/Work/Projects/auditrail/docs/08-agent-quickstart.md:1)

That path is the shortest repo-native way to find the right feature files and commands without scanning unrelated code.

## Deploying

For Coolify deployment, the repo now includes:

- a root `Dockerfile` reused by `web` and `api`
- `docker-compose.coolify.yml` for a single Coolify stack containing `web`, `api`, `worker`, and `postgres`
- the web image prebuilds the Next.js app and the runtime command only serves the compiled output

See [docs/06-deployment.md](/Users/denistarasenko/Work/Projects/auditrail/docs/06-deployment.md:1) for the required env vars and the stack setup.
The current deployment stack ships `web`, `api`, `worker`, and `postgres`.
The API and worker containers still use source-runtime startup commands today;
compiled-runtime hardening remains a later runtime slice.

Operational procedures for backup/restore, secret rotation, migration
rollback, rate limiting, and incident handling are documented in
[docs/09-operations.md](./docs/09-operations.md).

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
  -H 'authorization: Bearer <dashboard_api_key>' \
  -d '{"event":"user.deleted","actor":"admin_123","target":"user_456","metadata":{"reason":"GDPR request"}}'
```

List recent events:

```bash
curl -i 'http://localhost:4000/api/v1/events?limit=25' \
  -H 'authorization: Bearer <dashboard_api_key>'
```

Filter events:

```bash
curl -i 'http://localhost:4000/api/v1/events?event=user.deleted&actor=admin_123&from=2026-06-16T12:00:00.000Z&to=2026-06-16T13:00:00.000Z' \
  -H 'authorization: Bearer <dashboard_api_key>'
```

Paginate and use multi-value filters:

```bash
curl -i 'http://localhost:4000/api/v1/events?limit=2&events=user.deleted,role.changed&actors=admin_123,service_456' \
  -H 'authorization: Bearer <dashboard_api_key>'
```

Continue to the next page:

```bash
curl -i 'http://localhost:4000/api/v1/events?limit=2&cursor=<nextCursor>' \
  -H 'authorization: Bearer <dashboard_api_key>'
```

Get summary stats:

```bash
curl -i 'http://localhost:4000/api/v1/events/stats?top=5&from=2026-06-16T12:00:00.000Z&to=2026-06-16T13:00:00.000Z' \
  -H 'authorization: Bearer <dashboard_api_key>'
```

The primary guided setup path now lives on `/getting-started`. It reuses the
existing settings and API-key flows for project creation, key generation,
teammate invites, and the first-event ingest command.

The generated-resource AI workflow is now bounded end to end:

- `pnpm saas agent context resource ...` emits concise repo context for the resource task
- `pnpm saas agent recipe resource-install ...` emits a deterministic install recipe with path policy, stop conditions, safe-apply guidance, verification steps, and report format

The local create-app flow now has planning plus candidate output generation:

- `pnpm saas plan scaffold my-saas-app` emits a deterministic dry-run scaffold plan built from extraction metadata, placeholder product seams, quality gates, and AI workflow hints
- `pnpm saas generate scaffold my-saas-app --output .generated/scaffolds/my-saas-app` writes a local candidate scaffold with placeholder product setup, a generated README, and a scaffold report
- `pnpm saas check scaffold my-saas-app` validates isolated repeated scaffold output for missing required files, forbidden imports, unresolved placeholders, determinism, and real-source non-mutation
- it does not publish a package, create a repo, or mutate runtime source

Organizations start on the `starter` plan and included events reset on UTC
calendar month boundaries:

- `starter`: `100_000` events per month
- `growth`: `1_000_000` events per month
- `scale`: `10_000_000` events per month

When an organization exhausts its monthly included events, `POST /api/v1/events`
returns `402 event_quota_exceeded`. Browser dashboard and session-scoped reads
remain available while over quota.

## Project Rules

Read `AGENTS.md` before making changes. The important constraints are:

- agents must not run shell commands directly
- all command execution is handed to the user
- API routes require tests
- API source coverage policy must return to at least 95%; the current enforced
  threshold drift is documented in `docs/04-quality-gates.md`
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
```

For browser-session auth, the API must also have auth routes enabled with:

```bash
AUTH_TOKEN_SECRET=replace-with-a-long-random-secret
WEB_PUBLIC_URL=http://localhost:3000
```

Standard API startup now requires a provider-backed magic-link sender. For local
manual sign-in without a delivery provider, use the explicit dev harness:

```bash
pnpm dev:api:local-auth
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
`apps/api` endpoints. Dashboard reads now follow the signed-in browser session
plus the selected `organizationId` and `projectId`, instead of a single global
web API key.

The web app also has a direct Fastify-backed magic-link sign-in flow. It
requests magic links from `/api/v1/auth/magic-links`, confirms callback tokens
through API-owned browser redirect endpoints, and protects the dashboard by
loading `/api/v1/me`. Production deployments on sibling `app.*` and `api.*`
subdomains use one shared HttpOnly session cookie via
`AUTH_SESSION_COOKIE_DOMAIN`, instead of mirroring `Set-Cookie` headers through
Next.js. Only `missing_session` is treated as anonymous; other API failures now
surface as real runtime errors. It still must not add Next.js route handlers,
`pages/api` endpoints, or proxy API routes.

Authenticated users can manage the MVP workspace path at `/settings`: create
organizations, create projects for the selected organization, generate or
revoke project API keys, and copy the first-event ingestion command. Invitation
flows still exist, but they are secondary to the hosted MVP path.

The web UI system is Tailwind-first. Shared primitives live in
`apps/web/src/components/ui`, feature components compose those primitives, and
`apps/web/app/globals.css` should stay limited to Tailwind import, semantic
tokens, reset, and base styles.

Production platform work is staged behind tested API modules. Custom auth,
organizations, invitations, and API keys start as pure `apps/api` services
with repository interfaces and unit tests; Fastify routes should be added only
with route tests and docs in the same change.
