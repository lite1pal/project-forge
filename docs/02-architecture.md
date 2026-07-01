# Architecture

AuditTrail uses a TypeScript monorepo with small deployable apps and narrow shared packages.

## Extraction Posture

This repository is intentionally an audit-log product, not a generic SaaS
boilerplate. The code should still be shaped so later extraction into a
separate boilerplate repo is mechanical.

Use these labels when changing architecture:

- `platform-core`: would exist in almost any multi-tenant SaaS
- `platform-extension`: reusable SaaS capability that this repo may add later
- `audit-product`: specific to AuditTrail's event-ingest and event-read product

The current source-root boundary map for future static enforcement is exposed at
`tools/architecture-boundaries/rules.ts`.

The planned extraction manifest for future boilerplate work is exposed at
`tools/extraction/manifest.ts`.

The read-only extraction dry-run planner is exposed at
`tools/extraction/dry-run.ts`.

The local-only candidate output writer is exposed at
`tools/extraction/extract.ts`.

The placeholder-product scaffold validator is exposed at
`tools/extraction/validate-placeholder-product.ts`. It layers a tiny
placeholder product fixture onto the ignored generated candidate output and
asserts that the product-definition, onboarding, and shell seams can be wired
without importing AuditTrail-specific modules.

The first repo-local framework CLI now lives under `tools/saas/*`.
`saas doctor` and `saas plan resource` are inspection-only tooling: they may
read repo metadata, framework contracts, extraction metadata,
product-definition seams, and resource specs, but they must not generate app
code, mutate scaffold output, or change runtime behavior in the same slice.

The first write-capable framework command now also lives there:
`pnpm saas add resource <resource-spec.json> --output <preview-dir>`. It is
intentionally preview-only in this repo slice. It reuses the canonical
resource schema plus the dry-run planner, supports one narrow organization-
owned CRUD shape, and writes deterministic local preview files under
`.generated/` or `tmp/` without registering routes, changing runtime source,
or generating a real AuditTrail product resource.

The first AI-agent workflow command also lives under `tools/saas/*`:
`pnpm saas agent context resource <resource-spec.json>`. It is context-only.
It validates the same resource spec, reuses the dry-run planner and generator
support metadata, and emits a concise deterministic task bundle for AI coding
agents without mutating app source, generated runtime code, or product wiring.

The first full generated-resource AI install workflow command also lives under
`tools/saas/*`: `pnpm saas agent recipe resource-install <resource-spec.json>`.
It stays deterministic and repo-local, reuses the same schema plus planner and
agent-context metadata, and packages planning, preview, smoke-check, safe-
apply, customization, and verification guidance into one bounded recipe
without adding new generator behavior or mutating real runtime source.

The first future create-app planning command also lives under `tools/saas/*`:
`pnpm saas plan scaffold <app-name>`. It is planning-only. It reuses
extraction dry-run metadata, placeholder-product validation metadata,
framework quality-gate seams, and AI workflow commands to describe a future
scaffold flow without creating a package, generating scaffold output, or
changing runtime source.

The first local candidate scaffold generator also lives under `tools/saas/*`:
`pnpm saas generate scaffold <app-name> --output <target-dir>`. It reuses the
same scaffold planner plus extraction output and placeholder-product tooling,
writes deterministic local output under `.generated/` or `tmp/`, emits a
generated README and scaffold report, and fails closed on unsafe paths,
unsupported options, unresolved placeholders, product-specific leakage, or
unexpected overwrite attempts. It still does not publish a package, create a
repo, or mutate AuditTrail runtime source.

The next scaffold validation command also lives there:
`pnpm saas check scaffold <app-name>`. It generates the scaffold candidate
twice into isolated ignored temp output, validates required scaffold files,
placeholder-product output, forbidden AuditTrail imports, unresolved
placeholders, deterministic repeated output, and real-source non-mutation, and
then cleans up the temp directories.

The first generator stability command also lives there:
`pnpm saas check generators`. It regenerates committed fixture resources into a
safe temp directory, compares paths and contents against golden fixtures, and
fails on drift without touching runtime source. An explicit `--update` mode may
refresh those committed fixtures intentionally.

The next generated-output validation command also lives there:
`pnpm saas check generated-resource`. It generates the committed fixture
resource into an isolated ignored temp directory, reuses the planner plus
golden-fixture comparison, and validates structural readiness signals such as
expected file groups, deterministic repeated output, generic import safety,
placeholder cleanup, and syntax-parsable TypeScript or TSX files without
registering a real runtime resource.

The first opt-in apply command now also lives there:
`pnpm saas apply resource <resource-spec.json> --target <target-dir>`. It
still reuses the same schema, planner, generator, golden-fixture logic where
applicable, and smoke validation first. Current safe apply scope is
conservative: it can write generated files into an isolated target tree plus
patch stable domain and DB registration files. A companion root install command
now exists as `pnpm saas install resource <resource-spec.json>`, and that path
adds one deterministic runtime seam for `apps/api/src/app.ts` route
registration and now also emits a deterministic SQL migration plus Drizzle
journal update for the supported resource slice. The generated API module now
also includes a concrete organization-scoped Postgres repo implementation for
the supported CRUD subset, so route and service previews can execute without
hand-written persistence glue. Any central runtime file outside those explicit
seams must still fail closed rather than being guessed.

The current end-to-end proof resource is `customer`. It is committed into:

- `apps/api/src/modules/generated/customer/*`
- `apps/web/src/features/customer/*`
- `packages/domain/src/generated/customer/index.ts`
- `packages/db/src/schema/customer.ts`
- `packages/db/src/migrations/0012_customer.sql`

That proof slice establishes the current supported contract:

- generated organization-owned routes require a session
- reads allow `owner`, `admin`, `member`, and `viewer`
- writes allow `owner`, `admin`, and `member`
- generated list routes return `{ items: [...] }`
- rerunning install for an already-generated resource is allowed with `--force`
  when the existing files are already generator-owned

The rule is strict: `platform-*` code must not depend on `audit-product` code.
Audit-specific modules may depend on platform modules, but never the reverse.

Enforce the current map locally with:

```bash
pnpm check:boundaries
```

## Apps

`apps/api` owns HTTP behavior:

- request validation
- API key authentication
- rate limiting
- request ID correlation and structured request logging
- event ingestion
- event reads
- API-specific tests and coverage gates

`apps/web` owns the hosted MVP user journey. It should call the API instead of importing API internals.

`apps/landing` owns the public marketing site for Project Anvil. It should stay
isolated from authenticated product runtime composition, must not become a
shared dumping ground for app-shell code, and should treat framework messaging
as public copy rather than as a source of runtime contracts.

`apps/worker` owns the background-job runtime boundary. It now validates worker
env, polls the durable outbox, dispatches registered handlers, retries failed
jobs through the shared outbox semantics, shuts down gracefully, and now owns
the concrete outbound project-webhook delivery side effect for audit-event
ingest.

Current classification:

- `apps/api`: mixed `platform-core` and `audit-product`, with boundaries kept at the module level
- `apps/landing`: `platform-extension`
- `apps/web`: mixed `platform-core` and `audit-product`, with boundaries kept at the feature level
- `apps/worker`: `platform-extension`

## Packages

`packages/domain` contains pure schemas and domain types. It must not import framework, database, filesystem, queue, or env code.

Pricing policy also lives in `packages/domain`. The pricing catalog, plan ids,
and UTC month-window helpers are code-defined so both API adapters and tests can
share one pure source of truth for quotas.

Generic entitlement vocabulary also now lives in
`packages/domain/src/entitlements`. That seam defines product-neutral feature
keys, meter keys, feature-gate and meter-limit schemas, plus pure entitlement
decision helpers. It must remain pure and must not add API services,
repositories, billing-provider logic, or runtime quota enforcement in the same
slice. Product ownership now travels alongside resolved entitlements through a
small `ProductPlanEntitlement` wrapper so platform services can evaluate
shared billing state against the correct product namespace without assuming one
global product.

Generic billing vocabulary now also lives in `packages/domain/src/billing`.
That seam defines provider-aware but provider-neutral billing customer, plan,
price, subscription, checkout-intent, and portal-intent schemas plus the pure
link from a billing plan to an entitlement plan. It must remain pure and must
not add Stripe SDK imports, webhook handling, checkout or portal routes,
subscription persistence, invoices, or payment-method runtime behavior in the
same slice.

Generic billing persistence now lives in `packages/db/src/schema/billing.ts`
plus `apps/api/src/modules/platform/billing/*`. The `billing_customers` and
`billing_subscriptions` tables and the Postgres repository adapter are the
platform-owned storage seam for provider customer and subscription state. This
slice is persistence only for now: it must not add Stripe SDK imports,
checkout or portal routes, webhook handlers, invoices, payment methods, or
entitlement-enforcement behavior in the same change.

The platform billing API seam now also lives under
`apps/api/src/modules/platform/billing/*`. That layer exposes authenticated,
organization-scoped billing status plus checkout and portal actions backed by a
generic billing service. Real provider behavior now sits behind a
platform-owned provider runtime that resolves the active provider internally,
keeps provider-specific config validation and plan resolution inside adapters,
and lets public route contracts stay generic even when Stripe-backed session
URLs are returned. The API seam must not leak provider SDK types,
provider-specific route shapes, or AuditTrail-specific billing assumptions
upward into the web app.

The API-side platform entitlement service now lives under
`apps/api/src/modules/platform/entitlements`. That seam resolves the current
organization plan plus generic monthly meter usage into feature and meter
decisions by calling the pure domain helpers. It is platform-owned and generic:
it must not expose product-specific routes or replace the current audit-event
ingest quota enforcement path in the same slice. Product code should prefer
its combined meter-evaluation seam when it needs both an allow or deny
decision and the current quota snapshot, so one entitlement read can serve
both decisions and response metadata. The runtime now accepts an explicit
`productId` per evaluation, returns product-owned usage rows in summaries, and
keeps one internal default-product seam only for callers that have not become
product-aware yet.

Generic product-definition types also live in `packages/domain/src/product`.
That module now defines both the reusable manifest shape and the pure registry
helpers used to resolve enabled products from persisted installed-product
state without importing app runtime code.

Generic background job vocabulary now also lives in
`packages/domain/src/jobs`. That seam defines reusable job names, statuses,
JSON-like payload validation, and envelope parsing only. It must remain pure
and must not introduce outbox tables, queue clients, workers, or runtime job
processing. The shared job domain now also exposes a small product-ownership
map so async work such as audit-event side effects and webhook delivery can be
classified by owning product without leaking worker code into domain helpers.

Generic durable background-job persistence now lives in
`packages/db/src/schema/jobs.ts` plus `packages/db/src/job-outbox.ts`. The
`job_outbox` table and shared Postgres repository adapter are the reusable
outbox seam for async side effects such as webhook delivery, notifications,
exports, or integrity checks.

The API-side jobs module under `apps/api/src/modules/jobs/*` is now a thin
re-export seam over that shared adapter so app code can keep its current import
paths while the actual persistence logic stays package-owned and reusable.

Organization-owned platform and product repositories must fail closed on tenant
scope. For organization-scoped and project-scoped reads or writes, the
repository contract itself must take an explicit `organizationId` and apply it
in the persistence predicate or through a scoped lookup that can safely return
no rows. Service-layer authorization alone is not a sufficient tenant-isolation
boundary because ID-only repository methods are too easy to reuse incorrectly.

Audit-event persistence has one extra tenant-isolation rule because the table
stores both `organization_id` and `project_id` as independent foreign keys.
The repository must verify that the project actually belongs to the requested
organization on both reads and writes instead of trusting those columns to stay
consistent forever. That keeps corrupted or manually inserted rows from
becoming a cross-organization data leak.

The independently runnable worker boundary now lives under `apps/worker`. That
app now runs a real polling loop against the shared outbox repository, uses the
generic job-handler registry for dispatch, and now wires both the safe
`audit-event.created` acknowledgement handler and the concrete
`project.webhook.deliver` handler that loads persisted webhook deliveries,
signs outbound requests, and records success or failure state.

The concrete AuditTrail-owned product definition now lives under
`packages/domain/src/audit-events/product.ts`. It reuses the generic product
shape and audit onboarding catalog while staying behind the audit-product
package entrypoint rather than the product-neutral root barrel.

Installed-product state now lives in two platform-owned seams:
`packages/domain/src/product/product-registry.ts` defines the pure enabled-
product state and manifest registry, while
`packages/db/src/schema/products.ts` persists organization-level installed
products. The current-user context now carries that installed-product list per
organization so both the API and web runtime can fail closed when a product
module is registered globally but disabled for the selected organization.

AuditTrail-specific onboarding labels, descriptions, sidebar copy, and CTA
targets are now defined under that audit-owned product config and adapted
through one `apps/web/app/product-module.ts` composition boundary before the
reusable `apps/web/src/features/onboarding` UI renders them. The onboarding
feature itself must remain generic and must not import audit-product modules
directly.

AuditTrail-specific shell navigation now follows the same rule. Product nav
metadata lives in `packages/domain/src/audit-events/product.ts`, and the same
`apps/web/app/product-module.ts` boundary adapts those items into
workspace-aware hrefs before `apps/web/src/components/layout/app-shell.tsx`
renders them. Shared shell code must not import audit-product modules directly.
That adapter is now registry-driven: it resolves the active product plus the
installed product list for the current organization, so the shell can render
product launch links without embedding AuditTrail-only assumptions.

The remaining app-level product chrome, such as metadata title/description and
top-level loading/error copy, is also sourced from the audit-owned product
definition through that same single app product-module adapter. This keeps
generic app files free of product strings while preserving the same UI.

The API bootstrap now follows the same pattern. Product-owned route
registration declarations still live in the manifest under
`packages/domain/src/audit-events/product.ts`, but `apps/api/src/product-module.ts`
is now the only API composition seam that interprets those declarations and
mounts registered product routes into the shared Fastify runtime. The generic
API bootstrap no longer hardcodes AuditTrail route plugins directly, and the
public `/api` descriptor now reports the registered product list as part of
that central composition boundary.

## Multi-Product Target

The current repo still runs one concrete product, AuditTrail, on top of a
growing platform core. True platform/product separation is not complete until
product composition becomes data-driven instead of app-patch-driven.

The target shape is:

- `platform-core`: auth, organizations, memberships, billing primitives,
  entitlements, generic jobs, generic shell, settings framework, runtime
  registry, and product-install lifecycle
- `product-module`: product identity, navigation, onboarding, owned resources,
  route-registration metadata, capability declarations, meters, and docs
- `platform-runtime`: loads declared product modules, resolves installed
  products for the current organization, and composes API plus web surfaces
  without hardcoding one product

The first pure contract for that target now lives in the repo as
`productModuleManifestSchema` plus the registry helpers under
`packages/domain/src/product/*` and as the tooling-facing
`frameworkProductModuleManifestSchema` under `packages/framework/src/*`. Those
schemas remain runtime-free: they describe product identity, chrome metadata,
navigation, onboarding content, owned resources, capability declarations, and
runtime-registration metadata, while the registry resolves enabled products
from installed-product state without loading modules itself.

What is still missing from the current repo:

- product-owned page routing and launch flow beyond the current reference
  AuditTrail screens
- deeper billing-provider inbound sync and subscription projection for future
  non-Stripe adapters
- product-specific billing catalogs and entitlement mappings beyond the
  current default AuditTrail-owned runtime seam

The implementation order should stay narrow:

1. define the pure product-module contract
1. move AuditTrail behind that contract without changing runtime behavior
1. persist installed-product state
1. make shell and API composition registry-driven for multiple installed products
1. deepen product-owned billing catalogs and route surfaces where the current
   shared runtime still defaults to AuditTrail

Until those slices land, the repo should still be described honestly as a
framework-in-progress plus a reference product, not as a finished multi-product
runtime host.

The audit-events feature now follows the same pattern for product-facing copy.
Audit-specific screen, dashboard, chart, empty-state, table, and detail-panel
text is sourced from `packages/domain/src/audit-events/product.ts` through a
feature-local audit adapter rather than being embedded inline in components.

AuditTrail-specific plan and usage copy now also follows that seam. The
platform-owned organizations settings feature receives plan/quota labels and
descriptions through the `apps/web/app/settings` composition boundary rather
than embedding AuditTrail event-usage language directly in reusable settings
components.

The same settings surface now also owns the generic billing UI seam. Billing
status and checkout or portal actions live under
`apps/web/src/features/organizations/*` and call the platform billing API
routes directly. The UI still stays provider-neutral: it only understands the
generic billing status plus safe session-link responses from the API, and it
does not import provider SDKs or construct provider checkout URLs locally.

Project-scoped outbound webhooks now follow the same boundary. Generic webhook
vocabulary lives in `packages/domain/src/webhooks`, SQL storage lives in
`packages/db/src/schema/webhooks.ts`, the authenticated management API lives
under `apps/api/src/modules/platform/webhooks/*`, and audit-event ingest fans
out durable delivery jobs by writing both product-visible delivery rows and
generic outbox jobs in one transaction. The web settings surface manages
endpoint URL, enabled state, subscribed events, and secret rotation through
the API without calling worker internals directly. Webhook payloads and
delivery headers now also carry the owning `productId`, so outbound consumers
can verify both the signature and the product namespace that emitted the
event.

`packages/config` contains reusable config parsing helpers.

`packages/framework` contains pure framework contract schemas and types for
future CLI, generator, extraction-validation, and AI-agent tooling. It is
public framework vocabulary only: no runtime adapters, code generation,
filesystem writes, shell execution, env access, or AuditTrail product imports
belong there. The canonical resource authoring seam now also lives there as
`frameworkResourceSpecSchema`, with a pure normalization helper for default
CRUD, UI, API-prefix, plural-label, and timestamp behavior.

`packages/architecture-boundaries` contains typed source-root boundary metadata
for future architecture scanners. It is build-time metadata only and does not
participate in runtime behavior.

`packages/db` contains Drizzle schema, database client creation, migrations, and seed helpers.

`packages/testkit` contains reusable test helpers only.

Current classification:

- `packages/config`: `platform-core`
- `packages/db`: mixed infrastructure for both platform and audit modules
- `packages/domain`: mixed pure platform and audit domain helpers, which should stay separated by folder and import direction
- `packages/framework`: `platform-extension`
- `packages/testkit`: `platform-core`

The generic `@auditrail/domain` barrel must stay product-neutral. AuditTrail-
specific event and onboarding modules remain under `@auditrail/domain/audit-events`
rather than being re-exported through the root package entrypoint.

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

Cross-cutting request runtime behavior belongs in small Fastify plugins under
`apps/api/src/plugins/*` rather than being reimplemented inside feature routes.
The current runtime seam includes request ID generation or reuse via
`x-request-id` plus one structured completion log per request with only
selected safe fields such as method, route, status, duration, and request
correlation. Raw request bodies, auth headers, cookies, and audit-event
metadata must not be emitted into those logs.

Centralized API error policy also belongs in the app-level runtime seam rather
than in feature routes. `apps/api/src/http-errors.ts` preserves explicit
validation and known safe error shapes, but production-mode unknown failures
must be collapsed to a generic internal error response while request logs keep
the correlation ID and safe metadata.

For future extraction, module shape should also preserve domain ownership:

- `platform-core` modules may depend on shared packages and other platform modules
- `audit-product` modules may depend on platform modules
- platform modules must never import audit services, audit schemas, or audit repos

## Current Event Flow

```text
Client
  -> Fastify rate limiter
  -> API key auth
  -> Zod payload validation
  -> Audit event service
  -> Postgres repo
  -> organization_monthly_usage quota update
  -> audit_events table
  -> job_outbox audit-event.created enqueue
```

The read path uses the same API key principal to scope events to the authenticated project.
Quota enforcement happens only on the public ingest path. Event reads, stats,
and timeseries remain available after a workspace reaches its monthly included
event limit. The audit ingest path now asks the platform entitlement service
for the generic `events` meter decision plus current quota snapshot before
attempting the quota-protected write, while the audit-owned repository keeps
the conditional usage increment as the write-time guard so event insert and
usage accounting stay aligned.
Successful ingest now also writes a generic `audit-event.created` outbox job in
the same audit-owned persistence slice so future worker-driven side effects can
be triggered from durable intent instead of inline API work.

This entire event flow is `audit-product`.

## Web Frontend Architecture

`apps/web` is a pure Next.js UI application. It must consume the existing
Fastify API under `apps/api` and must not introduce Next.js route handlers,
`pages/api` endpoints, proxy routes, or backend-for-frontend endpoints.

Frontend modules should mirror the successful API boundaries:

- route files are thin render adapters
- feature services own use cases
- API clients own HTTP calls to `/api/v1`
- domain modules own schemas, query parsing, and pure transformations
- presenters convert API DTOs into view models
- components render JSX only and stay under 120 lines

Feature code belongs under `apps/web/src/features/<feature>`. Shared primitives
belong under `apps/web/src/components/ui`, and shared infrastructure belongs
under `apps/web/src/lib`. Server data is owned by server component loaders and
feature-owned API clients, not by global client stores.

Protected browser screens must use the API-owned session model. Server
components forward the incoming HttpOnly session cookie to `apps/api`, and
client-side code may call browser-safe API endpoints with credentials included.
For split `app.*` and `api.*` production deployments, the API owns both sign-in
confirmation and sign-out redirects so the browser keeps one shared
domain-scoped session cookie instead of a mirrored web-only copy.
Do not expose ingestion or machine API keys through `NEXT_PUBLIC_*` variables.

The current hosted MVP slice is:

- browser sign-in
- organization creation
- project creation
- project API key generation and revocation
- audit-event ingestion through the public API
- event inspection through list, stats, and timeseries views

The frontend must keep this flow as a direct Fastify API consumer and use
`/api/v1/me` to protect browser sessions.

Feature pages should use a feature-owned server loader rather than composing
multiple services directly in `app/**/page.tsx`. Route files parse framework
input and render screens; loaders compose server-only API clients and feature
services. Loaders must support dependency injection for tests, matching the
API app's injectable route/service pattern.

API paths in `apps/web` are constrained by generated OpenAPI contract types from
`apps/api`. Feature API clients still Zod-validate responses at the boundary so
runtime failures remain explicit. Regenerate contract types with
`pnpm --filter web api:types` after API contract changes.

### Web UI System

`apps/web` uses a Tailwind-first UI system. Global CSS is limited to Tailwind
import, semantic CSS variables, document reset, and base body styles. Repeated
visual patterns belong in small primitives under `apps/web/src/components/ui`;
feature components compose those primitives with Tailwind utilities and must not
depend on broad global class selectors.

Shared primitives should stay generic: `Button`, `Input`, `Label`, `Card`,
`DataTable`, `EmptyState`, `PageShell`, `SectionHeader`, `MetricCard`,
`PaginationLink`, and `ChartPanel`. Feature-specific presentation remains in the
feature module, while business logic remains in domain, service, API, hook, or
server-loader modules.

All local imports inside `apps/web` must use the `@/...` alias rooted at
`apps/web`. Relative local imports such as `./foo` or `../bar` are not allowed.
This keeps file moves mechanical and makes cross-feature boundaries easier to
scan in reviews.

### Platform Modules

Production platform behavior starts in pure API modules before routes are added.
Custom auth lives under `apps/api/src/modules/auth`, organization/project
membership logic under `apps/api/src/modules/platform`, and machine credential
management under `apps/api/src/modules/api-keys`. These modules follow the same
pattern as audit events: Zod at boundaries, pure services, repository
interfaces, and tests before Fastify routes.

The web app mirrors those platform capabilities with feature boundaries under
`apps/web/src/features/auth`, `organizations`, `invitations`, `api-keys`, and
`onboarding`.

The organization/project UI lives under `apps/web/src/features/organizations`
and the protected `/settings` route. It uses server actions only as direct
Fastify API clients for create/invite/accept workflows; it does not introduce
Next.js route handlers or proxy endpoints. Shell workspace context is derived
from `/api/v1/me` through a pure presenter.

Auth routes are introduced behind an injectable Fastify route adapter. The route
layer owns HTTP-only session cookie serialization, while token creation,
verification, session lookup, and magic-link sending remain inside the auth
service boundary.

Platform persistence lives in `packages/db` and is exposed to API modules
through repository adapters. The schema includes users, magic links, sessions,
organization memberships, organization invitations, projects, API keys, and
audit events, plus the generic `job_outbox` table for durable asynchronous
work. Organization pricing state stores only the selected
`organizations.plan_id`, while monthly counters are persisted in
`organization_monthly_usage` keyed by `organization_id + month_start`. Browser
onboarding dismissal state is persisted separately in
`user_organization_onboarding_states` keyed by `organization_id + user_id`,
while milestone completion stays derived from projects, API keys, invitations,
and audit events instead of being duplicated into its own status table.
Outbox claim semantics stay inside the repository adapter so future workers can
reuse Postgres-safe `FOR UPDATE SKIP LOCKED` claiming without leaking Drizzle or
locking details into services. API services must continue to depend on
repository interfaces rather than Drizzle directly.

Browser session principal resolution is separate from machine API-key auth.
`sessionAuthPlugin` resolves HttpOnly cookie sessions into `request.sessionUser`
for browser routes. The existing API-key auth plugin remains responsible for
machine ingestion routes and continues to set `request.apiKeyPrincipal`.
The `/me` response is composed through the platform context service and includes
user, membership, organization, project, onboarding, and current monthly
plan-usage context.

The web library baseline is Radix UI and shadcn-style local primitives for UI,
Zod-validated Fastify API clients, TanStack Table for data grids, Recharts for
dashboard charts, and custom Fastify magic-link/session auth. OpenAPI types
must be generated from `apps/api`'s `/api/v1/openapi.json`; `apps/web` must not
become a second API contract source.

### Platform Core vs Audit Product

Current `platform-core` responsibilities in this repo:

- browser session auth and magic-link flows
- users, organizations, memberships, and invitations
- workspace selection and current-user context
- onboarding framework, dismissal state, and generic progress summary shape
- API key management as a generic machine-credential admin flow
- shared dashboard shell, settings shell, and UI primitives

Current `audit-product` responsibilities in this repo:

- audit-event ingestion
- audit-event reads, stats, and timeseries
- event-specific empty states and event inspection UI
- generic monthly usage metering through `organization_monthly_usage.meter_key + quantity`
- audit-specific onboarding milestones such as `first_event_ingested`

The current `/api/v1/me` onboarding response still reflects audit-product
milestones, but the platform module now owns that response shape locally instead
of importing audit-product helpers from `packages/domain/src/audit-events/**`.

Current `platform-extension` candidates that should stay generic when added:

- framework contract vocabulary for future CLI, generator, extraction, and
  agent tooling, with the current pure seam in `packages/framework`
- billing and subscriptions
- entitlements and generic usage meters, with the current pure domain seam in
  `packages/domain/src/entitlements` plus the API-side resolver seam in
  `apps/api/src/modules/platform/entitlements`
- background jobs and scheduling, with the current `job_outbox` persistence seam under `packages/db/src/job-outbox.ts` and the polling worker runtime under `apps/worker/*`
- notifications and outbound webhooks
- exports and delivery infrastructure
- internal support/admin role modeling and support-tool predicates, with explicit
  `none`, `support`, and `admin` values that do not bypass organization
  membership checks or grant customer-org access by themselves
- read-only support organization lookup and safe summary inspection, gated by
  the internal support/admin predicate and kept separate from normal product
  routes
- admin/support controls
- MFA, SSO, and enterprise auth controls

### Extraction Map

If this codebase later seeds a generic SaaS boilerplate, the canonical
machine-readable input is now `tools/extraction/manifest.ts`.

That manifest is advisory only:

- it does not perform extraction
- it does not claim the repo is extraction-ready
- a future extraction script should fail closed on unknown paths
- product-specific code must not be copied unless the manifest explicitly marks
  it for template replacement

The manifest separates:

- `copyToBoilerplate`: reusable platform-core and platform-extension paths
- `excludeFromBoilerplate`: AuditTrail-owned product paths
- `replaceWithTemplate`: product-shaped files that need placeholder boilerplate equivalents
- `requiresManualReview`: mixed ownership, docs, migrations, and composition files
- `platformCore`, `platformExtension`, and `productSpecific`: explicit ownership views for later dry-run tooling

The dry-run planner is intentionally source-repo tooling:

- it validates the current repo tree against the manifest
- it prints a deterministic plan only
- it fails closed on unknown tracked files, conflicting primary actions, unmatched required entries, and product-code leaks into the copy set
- it does not create extraction output or a scaffold repo

The output writer is intentionally more conservative than a real extraction:

- it reuses the same fail-closed planner before writing
- it writes only to ignored repo-local directories such as `.generated/saas-boilerplate/`
- it copies only explicit `copy` paths and writes minimal placeholders for explicit `template` paths
- it omits `exclude` and `manual-review` files from the generated tree
- it does not claim the generated directory is a supported boilerplate

Current examples captured there:

- boilerplate copy: auth, organizations, invitations, API keys, onboarding framework, jobs or worker skeletons, shared UI, config helpers, boundary tooling, and generic product-definition seams
- boilerplate copy also now includes the pure `packages/framework` contract
  vocabulary for future non-runtime tooling
- product-specific: audit-event API modules, audit-event web features, and `packages/domain/src/audit-events/**`
- template replacements: product definition config, nav adapters, onboarding copy adapters, app chrome, and other AuditTrail-branded surfaces
- explicit exclude: source-repo-only extraction preparation tooling such as `tools/extraction/**`, `tools/check-extraction-manifest.ts`, and boundary-scanner fixtures stay out of candidate boilerplate output entirely
- manual review: the remaining mixed `packages/db/**` surfaces such as the audit-event schema file and any migration history without explicit ownership, plus route composition files, docs, deployment files, and workspace config

Recent extraction-prep progress in `packages/db`:

- `packages/db/src/schema/identity.ts` is now treated as reusable platform storage instead of broad mixed ownership
- most concrete migrations now have explicit copy ownership in the extraction manifest
- the DB barrels and the initial migration that still mix reusable tables with the AuditTrail audit-event table remain explicit template targets instead of broad manual-review entries

Recent progress toward extraction:

- `packages/domain/src/onboarding/*` now contains only generic step definitions, progress summarization, and dismissal handling
- `packages/domain/src/audit-events/onboarding.ts` owns the current audit-product milestone ids and raw milestone-to-step mapping
- `packages/db/src/schema/identity.ts` now models monthly usage as a generic meter row with `meter_key` and `quantity`
- the current audit product still consumes that meter model as the `events` meter for pricing and quota enforcement
