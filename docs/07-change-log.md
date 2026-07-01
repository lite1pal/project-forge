# Change Log

## 2026-07-01

- Corrected the GitHub prerelease trigger so successful `Sync Alpha` runs now
  publish releases reliably. The original `push: alpha` release workflow never
  fired after automated branch promotion because GitHub suppresses downstream
  workflow triggers for pushes created by `GITHUB_TOKEN`; the release lane now
  also listens for successful `workflow_run` completion from `Sync Alpha`,
  checks out `alpha` explicitly, and keeps direct `alpha` pushes working.

- Cleaned up the generated-resource verification lane so it follows the newer
  web product-module seam instead of deleted `audit-product-*` adapter files.
  The resource planner, smoke checks, extraction manifest, and focused SaaS
  test script now align with `apps/web/app/product-module.ts`, and
  `.generated/**` output no longer pollutes `pnpm test:saas`.

- Completed T-093 by proving one generated resource end to end against
  Postgres. The committed `customer` slice now installs through the supported
  CLI seam into real app, domain, DB, and web paths; generated organization
  routes now require sessions plus organization membership; generated list
  routes return `{ items: [...] }`; the resource planner now tolerates
  generator-owned reruns for already-installed resources; and the proof path is
  covered by generator/apply/smoke tests, API typecheck, route unit tests, and
  a real Postgres integration test at
  `apps/api/src/modules/generated/customer/__tests__/routes.integration.test.ts`.

- Added the first repo-level GitHub prerelease automation for Elioric.
  The repo now uses `semantic-release` plus a GitHub Actions workflow on the
  `alpha` branch to run `pnpm verify`, calculate an `alpha` prerelease from
  Conventional Commit messages, and publish Git tags plus GitHub Releases
  without introducing npm publishing or changelog commit-back yet. `main`
  remains available as the future stable-release branch.

- Added a second GitHub Actions workflow that promotes `main` into `alpha`
  automatically. The current release posture is now: merge into `main`, let
  CI sync `alpha`, and let the prerelease workflow publish from `alpha` after
  the verification gate passes. Merge conflicts fail the sync step instead of
  being resolved automatically in CI.

- Renamed the framework-facing repo and landing copy from Project Forge to
  Elioric so the README, landing app, and framework docs describe one
  consistent platform identity while AuditTrail remains the reference product.

- Split the remaining shared billing, entitlement, webhook, and job seams by
  product ownership. Billing plans and plan-to-entitlement links now carry a
  `productId`, entitlement summaries resolve against product-owned mappings,
  shared job definitions expose owning product metadata, and outbound webhook
  payloads plus headers now identify the emitting product explicitly.

- Updated the demo seed and audit-event integration fixtures to install the
  current AuditTrail product for seeded organizations, keeping the newer
  installed-product runtime checks green in real-db ingest coverage instead of
  bypassing the platform contract.

- Made shell and API composition registry-driven for multiple installed
  products. The API product runtime now registers routes by iterating
  registered product modules instead of assuming one hardcoded product, the
  public `/api` descriptor reports registered products, and the web shell now
  derives available product links from installed-product state for the active
  organization.

- Added persisted organization installed-product state plus a pure product
  manifest registry. The platform now records enabled products per
  organization, injects that state into `/api/v1/me`, auto-installs the
  current AuditTrail product for new organizations, and fails closed in both
  API and web workspace resolution when a selected organization does not have
  the product enabled.

- Added `apps/landing` as an isolated Astro marketing app for Elioric,
  then replaced the first trial template with the user-selected
  MIT-licensed `Tailcast` Astro theme, reduced it to a single framework-focused
  page, and kept the landing deployment and docs clearly separate from the
  authenticated product runtime.

- Moved the remaining AuditTrail product composition behind explicit product
  module seams. The audit-owned domain package now exposes one product-module
  helper for shell nav, onboarding copy, workspace settings copy, and runtime
  registration metadata, while `apps/web/app/product-module.ts` and
  `apps/api/src/product-module.ts` became the only app-level composition
  adapters consuming that declaration.

## 2026-06-30

- Added an explicit post-MVP task sequence for true platform/product
  separation: define a product-module contract, move AuditTrail behind it, add
  installed-product state, make composition registry-driven, and then split
  billing, entitlements, jobs, and webhook ownership cleanly for a future
  multi-product runtime.

- Added the first pure product-module manifest contracts in `packages/domain`
  and `packages/framework`. The new schemas define product identity, chrome,
  navigation, onboarding content, owned resources, capability declarations,
  and runtime-registration metadata without introducing module loading or
  installed-product persistence yet, and the current AuditTrail product
  definition now validates against that richer contract.

- Tightened tenant isolation in the platform and API-key modules by making
  organization scope explicit in repository contracts for project API-key reads
  and revokes plus invitation accept or revoke writes, so those paths now fail
  closed when org scope is missing or mismatched instead of relying only on
  upstream service checks.

- Tightened the audit-event data boundary by making the Postgres repo verify
  that a project belongs to the requested organization before event reads or
  writes proceed, added direct integration coverage for mismatched org-project
  scope against corrupted rows, and proved dashboard event routes reject
  another organization's data instead of exposing it.

- Hardened ingest failure-path coverage around `POST /api/v1/events` by adding
  real-db checks for validation, auth, revoked-key, quota, and rate-limit
  behavior, and by proving the event write, monthly usage update, and durable
  outbox enqueue side effects stay consistent on success and do not partially
  escape on rejected requests.

- Refactored the platform billing runtime into an internal provider registry
  and active-provider resolver, generalized the shared provider enums beyond a
  Stripe-only contract, and kept the public billing routes provider-neutral
  while Stripe remains the only concrete configured session adapter today.

- Added project-scoped outbound webhook management end to end: shared webhook
  domain vocabulary, SQL storage for endpoints and delivery history,
  authenticated API routes, settings UI, ingest-side fan-out into durable
  outbox jobs, and a worker delivery handler that signs requests and records
  retry or terminal failure state.

- Moved the generic durable outbox adapter into
  `packages/db/src/job-outbox.ts`, kept the API jobs module as a thin
  re-export seam, and finished the worker runtime so it now polls the shared
  outbox, dispatches registered handlers, retries handler failures, and drains
  the current `audit-event.created` job path instead of idling as a shell.

- Wired the hosted Compose stack to include a `worker` service and added a root
  `start:worker:container` command. The current deployment now runs
  `web + api + worker + postgres`, while webhook delivery still remains future
  work and both backend processes still use source-runtime startup paths.

- Reset the active roadmap and task queue around the hosted AuditTrail MVP
  instead of framework-first expansion. The current docs now make the deployed
  contract explicit as `web + api + postgres`, keep `apps/worker` and webhook
  delivery as future work, and treat the API container's source-runtime
  `tsx` startup path as an accepted documented MVP limitation until a later
  hardening slice proves the compiled runtime safely.

- Added a hosted-MVP release-gate section and manual production smoke checklist
  to the docs so sign-in, org/project setup, API key lifecycle, ingest, and
  dashboard visibility are the concrete acceptance path instead of extraction
  tooling expansion.

- Reclassified source-repo-only extraction tooling paths
  (`tools/extraction/**`, `tools/check-extraction-manifest.ts`, and
  boundary-scanner fixtures) from scaffold `manual-review` seams to explicit
  `exclude` entries in the extraction manifest so local candidate output does
  not treat repo-prep tooling as pending boilerplate work.

- Added a focused extraction-manifest test covering the explicit exclusion
  policy for source-repo-only tooling paths.

## 2026-06-29

- Added `pnpm saas check scaffold <app-name>` as the first isolated scaffold
  smoke validation command. It reuses the local scaffold generator, validates
  required scaffold files, placeholder-product output, forbidden AuditTrail
  imports, unresolved placeholders, deterministic repeated output, and real-
  source non-mutation, and cleans up temp output after the check.

- Added focused scaffold-smoke tests covering pass, missing required files,
  forbidden imports, unresolved placeholders, repeated-generation drift,
  cleanup, CLI wiring, and runtime-mutation detection.

- Tightened the root `test:saas` and `test:extraction` scripts to explicit
  test-file globs so ignored generated output under `.generated/` and `tmp/`
  does not pollute focused tooling test runs.

- Added `pnpm saas generate scaffold <app-name> --output <target-dir>` as the
  first local-only candidate scaffold writer. It reuses the scaffold planner,
  extraction output, and placeholder-product tooling to emit deterministic
  scaffold output with a generated README and `.saas/scaffold-report.json`
  under ignored local directories only, without publishing a package, creating
  a repo, or mutating AuditTrail runtime source.

- Added focused scaffold-generator tests covering deterministic repeated
  output, invalid-name rejection, unsafe-path rejection, generated-owned
  overwrite safety, generated README and report presence, placeholder product
  output, identity replacement, forbidden-import rejection, unresolved-
  placeholder rejection, and real-source non-mutation.

- Added `pnpm saas plan scaffold <app-name>` as the first planning-only
  create-app scaffold command. It reuses extraction dry-run metadata,
  placeholder-product seams, framework quality gates, and AI workflow hints to
  emit a deterministic scaffold plan without creating output, publishing a
  package, creating a repo, or mutating runtime source.

- Added focused scaffold-planner tests covering deterministic output,
  invalid-name rejection, unsafe output-directory rejection, unsupported option
  failure, required plan groups, quality-gate coverage, AI workflow hints,
  stable JSON output, deterministic ordering, and no-write behavior.

- Added `pnpm saas agent recipe resource-install <resource-spec.json>` as the
  first deterministic full generated-resource AI workflow command. It reuses
  the canonical resource schema, dry-run planner, existing agent-context
  metadata, smoke-check guidance, and safe apply posture to emit one bounded
  install recipe without mutating real runtime source or broadening generator
  behavior.

- Added a tracked recipe template under
  `tools/saas/recipes/generated-resource-install.md` plus focused recipe tests
  covering deterministic markdown and JSON output, invalid-spec failure,
  planner-warning carry-through, derived allowed paths, forbidden AuditTrail
  product paths, required checks, stop conditions, concise doc references, and
  safe output-file behavior.

- Added `pnpm saas apply resource <resource-spec.json> --target <target-dir>`
  as the first explicit safe apply path for generated resources. It keeps
  preview generation as the default, stages generated output in temp storage,
  reuses smoke validation before writing, applies generated files into isolated
  targets, and patches only stable domain or DB registration files while
  refusing ambiguous central runtime edits.

- Added `pnpm saas install resource <resource-spec.json>` as the first
  repo-root generated-resource install path. It reuses the same planner,
  generator, and validation flow as isolated apply, but adds one deterministic
  `apps/api/src/app.ts` patch seam so generated API routes can be wired into
  the real runtime without hand-editing the bootstrap file for the current
  supported shape.

- Added `pnpm saas init resource <resource-name> --field ...` so new resource
  specs can be created entirely from the terminal. It writes validated JSON
  specs under `specs/` by default, reuses the canonical framework schema for
  normalization, and keeps defaults aligned with the current generator-safe
  resource slice.

- Generated-resource apply and install now also emit deterministic SQL
  migrations plus Drizzle journal updates for the supported resource slice, so
  install no longer stops at a manual migration placeholder before runtime
  promotion.

- Generated-resource API modules now emit concrete organization-scoped
  Postgres CRUD repos for the supported field subset, and the fixture-backed
  smoke path now proves those repo templates stay golden, syntax-safe, and
  ready to execute without hand-written persistence stubs. The repo-root
  golden and smoke check commands now also allow the fixture-only
  `existing-module-conflict` planner warning so documented verification still
  runs even when the fixture resource name overlaps an existing product path.

- Added focused apply-mode tests covering isolated-target success, overwrite
  safety, unsupported central patch failure, forbidden-import rejection,
  planner-block failure, deterministic central-file updates, repeated apply
  diagnostics, and real-source non-mutation in tests.

- Added `pnpm saas check generated-resource` as a deterministic isolated
  smoke check for the committed fixture resource. It generates into ignored
  temp output only, validates planner alignment, golden-fixture parity,
  expected file groups, generic import safety, unresolved-placeholder cleanup,
  deterministic repeat generation, and lightweight TypeScript syntax
  readiness without registering a real runtime resource.

- Added focused smoke-check tests covering pass, missing files, forbidden
  imports, unresolved placeholders, deterministic repeat output, unsupported
  specs, runtime-mutation detection, cleanup, and output-path safety.

- Added committed golden fixtures under `tools/saas/__fixtures__/generated/*`
  plus `pnpm saas check generators` so the current CRUD generator output can be
  regenerated into a safe temp directory and compared against a tracked
  deterministic fixture tree.

- Added drift detection for missing files, extra files, and content changes,
  plus an explicit `--update` mode that refreshes committed fixture
  directories only without touching runtime source or broadening generator
  capabilities.

- Added focused golden-fixture tests covering pass, missing, extra, changed,
  deterministic ordering, safe update behavior, and unsafe fixture-path
  rejection.

- Added `pnpm saas agent context resource <resource-spec.json>` as the first
  AI-agent workflow command under `tools/saas/*`. It validates the canonical
  resource spec, reuses the dry-run planner plus generator support metadata,
  and emits concise deterministic context for generated-resource tasks.

- Added markdown output by default, stable JSON with `--json`, and optional
  safe local artifact writes under `.generated/` or `tmp/` for future agent or
  MCP-adjacent tooling without mutating app source or generated runtime code.

- Added focused agent-context tests covering deterministic output, invalid-spec
  failure, forbidden-path policy, required checks, preserved manual-review
  warnings, concise doc references, deterministic ordering, and safe output
  file handling.

- Added `pnpm saas add resource <resource-spec.json> --output <preview-dir>`
  as the first real CRUD generator under `tools/saas/*`. It validates specs
  through the canonical framework schema, reuses the dry-run planner, and
  writes deterministic local preview files for one narrow organization-owned
  resource shape without mutating runtime source.

- Kept the first generator deliberately fail-closed. It rejects unsupported
  ownership modes, unsupported field types, delete generation, public API
  generation, product-nav wiring, existing target files without `--force`, and
  blocking planner warnings before writing preview output.

- Added generated domain, DB, API, web, test, and docs template output plus
  `CUSTOMIZE` guidance for safe follow-up without generating a real
  AuditTrail-owned runtime resource, route registration, or migration.

- Added fixture-backed generator tests covering deterministic output, planner
  alignment, overwrite safety, supported-subset enforcement, preview-output
  isolation, and AuditTrail-free generated content.

- Added `pnpm saas plan resource <resource-spec.json>` as the first read-only
  CRUD resource planner under `tools/saas/*`. It validates JSON specs through
  the canonical framework resource schema, normalizes defaults, and prints a
  deterministic grouped file plan without writing app code.

- Added focused planner warnings and manual-review reporting for delete-enabled
  resources, public organization-owned APIs without permissions, global or
  unowned resources, product-nav updates, migration placeholders, and existing
  repo path conflicts.

- Added example resource specs, planner tests, and SaaS-tooling verification
  notes so future generator work can build on a stable dry-run contract first.

- Added a canonical resource-spec schema to `packages/framework` for future
  resource planners, generators, and AI-agent context commands. The new pure
  contract covers resource identity, ownership, fields, CRUD flags, API/UI
  metadata, permissions, indexes, and timestamps.

- Added strict validation and normalization for resource specs, including
  reserved platform-name rejection, duplicate-field rejection, enum-value
  enforcement, API-prefix validation, CRUD safety checks, and derived defaults
  for plural labels, CRUD flags, UI flags, API prefixes, and timestamps.

- Added focused framework tests plus package-local documentation for the new
  resource authoring seam without adding planner code, file generation,
  runtime changes, or AuditTrail-specific dependencies.

- Added the first repo-local framework CLI command under `tools/saas/*`.
  `pnpm saas doctor` now inspects the repo for expected boundary, extraction,
  placeholder-validation, framework-contract, product-definition, and
  quality-gate seams without mutating scaffold output or runtime behavior.

- Added focused doctor tests for pass, fail, warning, deterministic ordering,
  and exit-code behavior, plus root scripts for `saas`, `saas:doctor`,
  `test:saas`, and `typecheck:saas`.

- Classified `tools/saas/**` in the extraction manifest so the new framework
  CLI is explicit reusable tooling rather than an unknown monitored path.

## 2026-06-28

- Added `packages/framework` as a pure public framework-contract package with
  generic Zod-validated definitions for modules, resources, fields, CRUD,
  routes, ownership, generator plans, checks, and AI-agent task or context
  metadata.

- Kept the framework layer intentionally non-runtime. It does not add a CLI,
  code generation, route wiring, database changes, extraction output, or any
  AuditTrail product imports.

- Updated the boundary scanner, extraction manifest, and architecture or
  quality-gate docs so the new framework package is classified as reusable
  platform-extension tooling and covered by focused typecheck and test gates.

## 2026-06-27

- added `tools/extraction/validate-placeholder-product.ts` plus
  `tools/extraction/placeholder-product.ts` so the local extraction candidate
  can be validated against a tiny placeholder product without importing
  AuditTrail-specific modules
- added focused extraction tests for placeholder product config validity,
  forbidden AuditTrail imports, required scaffold-file checks, and neutral
  placeholder validation paths
- documented placeholder scaffold validation as a local-only proof step rather
  than a published boilerplate guarantee

## 2026-06-26

- Added `tools/extraction/extract.ts` plus a small output module and focused
  tests so the repo can generate a local candidate boilerplate tree under an
  ignored directory without publishing or moving source files.

- Added `pnpm extract:boilerplate` and `.generated/` ignore rules. The writer
  reuses the fail-closed dry-run planner, copies only explicit platform paths,
  writes minimal placeholders for explicit template seams, and emits
  `EXTRACTION_README.md` plus `extraction-report.json` with the remaining
  manual-review set.

- Refined the extraction manifest for `packages/db/src` so the reusable
  identity schema and most concrete migrations now have explicit extraction
  ownership instead of living under one broad manual-review bucket.

- Reclassified the mixed DB barrels and the initial migration that still
  exports or creates the AuditTrail audit-event table as template targets,
  shrinking the remaining DB manual-review area to files that still need real
  rewrite or regeneration decisions.

- Added `tools/extraction/dry-run.ts` plus a pure planner module and focused
  tests so the repo can print a deterministic extraction plan without copying
  files or generating a boilerplate repo.

- Added `pnpm check:extraction` and `pnpm test:extraction` for the extraction
  dry-run path. The dry-run validates the current repo tree against the
  advisory manifest and fails closed on unknown tracked files, unmatched
  required entries, conflicting primary actions, or product-code leaks into the
  copy set.

- Refined the extraction manifest to classify API bootstrap files, web app
  composition files, DB support files, and source-repo-only extraction tooling
  so the dry-run can cover the current monitored roots explicitly.

- Added `tools/extraction/manifest.ts` as the canonical machine-readable
  advisory map for future boilerplate extraction, with explicit copy,
  exclude, template-replacement, and manual-review sections plus ownership
  views for `platform-core`, `platform-extension`, and AuditTrail product code.

- Added `tools/check-extraction-manifest.ts` plus
  `pnpm check:extraction-manifest` so the manifest can be validated without
  claiming extraction is implemented or touching runtime behavior.

- Documented the extraction manifest boundary in architecture, quality-gate,
  and next-step docs, including the rule that any future extraction script
  must fail closed on unknown paths and must not copy AuditTrail product code
  unless it is explicitly templated.

- Added the first internal support API seam under
  `apps/api/src/modules/platform/support/*`, including read-only organization
  search and detail routes gated by the internal support/admin predicate.

- Added `users.internal_role` persistence with a conservative `none` default
  so support authorization can come from the session user without changing
  product-route membership checks.

- Kept support lookup responses deliberately safe. They return organization and
  billing/entitlement summaries only, omitting API keys, session tokens,
  magic-link tokens, and raw audit payloads.

- Added a generic internal support role seam in `packages/domain/src/internal-support`
  with explicit `none`, `support`, and `admin` values plus pure access
  predicates for future support tooling.

- Kept the support-role seam intentionally non-runtime. It does not add
  persistence, support lookup routes, a console UI, or any change to customer
  organization membership checks or product-route authorization.

- Added a platform-owned billing provider adapter seam under
  `apps/api/src/modules/platform/billing/*` so checkout and portal actions can
  create real provider sessions without changing the generic web or API
  boundaries.

- Wired the current adapter implementation to Stripe's session endpoints behind
  that seam while keeping provider-specific configuration and price mapping on
  the API side instead of leaking Stripe identifiers into the web app.

- Changed the billing API and web billing actions from placeholder
  not-configured responses to provider-neutral session-link responses on
  success, while preserving stable `billing_provider_not_configured` and
  `billing_customer_not_found` failure codes.

- Added a generic billing section to the existing `/settings` workspace screen
  under `apps/web/src/features/organizations/*`, backed by the platform
  billing API status, checkout, and portal seams.

- Kept the billing settings UI provider-neutral. It renders persisted billing
  status when present and surfaces the current `billing_provider_not_configured`
  behavior inline instead of redirecting to external checkout or portal URLs.

- Added a platform-owned billing API seam under
  `apps/api/src/modules/platform/billing/*`, including an authenticated
  service and organization-scoped routes for billing status, checkout intent,
  and portal intent.

- Wired the billing status route to persisted generic billing customer and
  subscription state while keeping checkout and portal creation explicitly
  provider-not-configured until a future adapter is added.

- Kept the new billing API surface generic and non-provider-integrated. It does
  not add Stripe SDK imports, real provider session creation, webhook handling,
  billing UI, entitlement enforcement changes, or audit quota changes.

- Added generic billing persistence in `packages/db/src/schema/billing.ts` plus
  `apps/api/src/modules/platform/billing/*`, including platform-owned
  repository types, a Postgres adapter, and integration coverage for customer
  and subscription upsert, lookup, uniqueness, and organization isolation.

- Added `billing_customers` and `billing_subscriptions` through a new
  migration-only storage seam so future Stripe integration can persist provider
  customer and subscription state without coupling those tables to
  AuditTrail-specific product modules.

- Kept the billing persistence slice non-runtime and provider-neutral. It does
  not add Stripe SDK imports, billing routes, webhook handlers, billing UI, or
  any change to entitlement enforcement, audit quota behavior, or public API
  contracts.

- Added a generic `packages/domain/src/billing` seam for billing vocabulary,
  including provider-aware customer, plan, price, subscription, checkout, and
  portal schemas plus a pure billing-plan-to-entitlement-plan link helper.

- Kept the billing slice intentionally pure and non-runtime. It does not add a
  Stripe client, API routes, webhook handling, persistence, or any change to
  current entitlement enforcement or audit quota behavior.

- Refined the platform entitlement seam so product code can resolve a generic
  meter decision and the current entitlement summary from one snapshot read
  instead of separately asking for a decision and then a quota summary.

- Rewired audit-event ingest to consume that combined entitlement evaluation
  seam for the `events` meter while preserving the existing quota error
  contract, repository write-time guard, and outbox timing.

- Migrated the audit-event ingest quota decision to the platform-owned
  entitlement service, so the audit product now asks the generic `events`
  meter seam for allow or deny before quota-protected writes.

- Preserved the existing `402 event_quota_exceeded` contract and outbox timing
  by keeping the audit-owned repository's conditional monthly-usage update as
  the write-time guard and compatibility fallback under concurrent ingest.

- Added a platform-owned API entitlement service seam under
  `apps/api/src/modules/platform/entitlements` that resolves organization plan
  and current-month meter usage into generic feature and meter decisions using
  the pure domain entitlement helpers.

- Kept the new API entitlement service explicitly non-product-specific. It does
  not add public routes, billing-provider logic, or any change to the current
  audit-event quota enforcement path or response contracts.

- Added a generic `packages/domain/src/entitlements` seam for feature gates and
  meter-based plan limits, including pure Zod schemas and allow or deny
  decision helpers for future platform-extension billing or entitlement work.

- Kept the entitlement slice intentionally pure and generic: it does not add an
  API entitlement service, persistence adapter, billing provider, or any change
  to the current audit-event quota enforcement runtime.

- Added a practical production operations runbook in `docs/09-operations.md`
  covering backup and restore, secret rotation, migration rollback policy,
  rate-limit policy, environment checks, and incident/debugging flow for the
  current Coolify + Postgres + API + Web stack.

- Linked the new operations guide from the deployment docs and README so the
  current hosted stack has one obvious place for operator procedures without
  changing runtime behavior.

- Centralized API unknown-error handling so production responses now collapse
  to a generic `internal_server_error` shape while local development and test
  runs retain a deterministic debug `message` field.

- Preserved the existing validation, auth, quota, domain, and rate-limit
  response shapes while wiring unknown-failure logs to the request correlation
  ID with only safe metadata.

- Added API request correlation through `x-request-id`, with valid inbound IDs
  reused and invalid or missing IDs replaced by generated values that are also
  returned on the response header.

- Replaced the default Fastify request logging path with one structured
  completion log per request, carrying request ID, method, route, status, and
  duration without logging auth headers, cookies, API keys, request bodies, or
  arbitrary audit-event metadata.

- Connected audit-event ingest to the generic outbox by enqueueing a durable
  `audit-event.created` job after successful event persistence.

- Kept the enqueue payload audit-owned and minimal, currently
  `organizationId`, `projectId`, `eventId`, and `createdAt`, while leaving the
  shared outbox repo and worker registry product-neutral.

- Made the failure policy explicit: if outbox enqueue fails, ingest fails and
  the event write is rolled back so the audit event and async intent cannot
  drift.

- Added `apps/worker` as a generic `platform-extension` app boundary with its
  own package metadata, env validation, no-op job-handler registry, and
  graceful startup/shutdown wiring.

- Kept the new worker intentionally idle: it does not poll `job_outbox`, does
  not register product-specific handlers, and does not add a deployable Docker
  worker service yet.

- Added a generic `job_outbox` persistence seam in `packages/db` plus
  `apps/api/src/modules/jobs`, including a Postgres repository adapter for
  enqueue, claim, complete, fail, retry, and pending-count behavior.

- Added `packages/db/src/migrations/0007_job_outbox.sql` and Postgres
  integration tests for durable outbox semantics, including future scheduling,
  retry handling, max-attempt failure, and `FOR UPDATE SKIP LOCKED` claim
  safety.

- Classified `apps/api/src/modules/jobs/**` as `platform-extension` so generic
  jobs infrastructure can evolve without depending on `audit-product` code.

- Added a generic `packages/domain/src/jobs` seam for background job
  vocabulary, including typed job names, statuses, JSON-like payload schemas,
  and envelope parsing without adding any outbox, queue, or worker runtime.

- Moved the remaining AuditTrail audit-events feature copy, including event
  screen headers, empty-state text, dashboard labels, chart copy, table labels,
  and detail-panel text, behind the audit-owned product definition.

- Moved AuditTrail-specific plan and usage labels, quota descriptions, and
  usage-meter copy behind the audit-owned product definition plus a small
  `apps/web/app/settings` adapter so platform-owned settings components no
  longer embed AuditTrail event-usage language.

- Moved the remaining AuditTrail app chrome strings, including metadata,
  loading copy, and top-level error copy, behind the audit-owned product
  definition plus a small app-level adapter.

- Moved the AuditTrail shell nav item behind the audit-owned product definition
  plus a small app-level navigation adapter so shared shell code no longer
  hardcodes product navigation.

- Moved AuditTrail-specific onboarding step labels, descriptions, sidebar copy,
  and CTA targets behind the audit-owned product definition plus a
  `apps/web/app/getting-started` adapter so the reusable onboarding feature no
  longer hardcodes product assumptions.

- Added `packages/domain/src/audit-events/product.ts` as the explicit
  AuditTrail-owned product-definition seam. It reuses the generic product types
  from `packages/domain/src/product` without allowing platform modules to
  depend on product config.

- Added a generic `packages/domain/src/product` seam for product-definition
  types and pure validation schemas so future product-specific configuration can
  be made explicit without leaking AuditTrail details into reusable platform
  modules.

This file records meaningful architecture and structural changes so the codebase remains understandable across sessions and contributors.

## 2026-06-26 - Add Boundary Scanner To Normal Repo Verification

Changed:

- added a root `pnpm check:boundaries` command for the platform-vs-audit import scanner
- updated `pnpm verify` to run the boundary scanner before repo-wide typecheck and tests
- documented the boundary command and directional import rule in the agent and quality-gate docs

Why:

- platform-to-audit dependency violations should fail fast in normal repo verification instead of relying on manual scanner runs
- the current repo now passes the scanner, so the boundary rule can be part of everyday checks without introducing known red builds

Docs updated:

- `docs/01-agent-engineering-rules.md`
- `docs/02-architecture.md`
- `docs/04-quality-gates.md`
- `docs/07-change-log.md`

## 2026-06-26 - Remove Existing Platform-To-Audit Boundary Violations

Changed:

- stopped re-exporting `packages/domain/src/audit-events/*` through the generic `@auditrail/domain` barrel
- added a small platform-local onboarding shape module under `apps/api/src/modules/platform/*` so the current `/me` onboarding response no longer imports audit-product helpers directly
- kept the existing audit-product onboarding milestone names and `/me` response behavior unchanged while removing the scanner violations that blocked boundary enforcement

Why:

- the boundary scanner cannot be wired into normal verification while the repo still contains known `platform-core -> audit-product` imports
- the generic domain barrel must remain product-neutral so later extraction into a reusable platform repo stays mechanical

Docs updated:

- `docs/02-architecture.md`
- `docs/07-change-log.md`

## 2026-06-26 - Add A Typed Platform Boundary Map

Changed:

- added `packages/architecture-boundaries` as a dedicated shared package for architecture boundary metadata
- defined typed `platform-core`, `platform-extension`, `audit-product`, and `mixed` source-root categories with human-readable labels, descriptions, glob patterns, and allowed dependency targets
- documented the boundary map location in the architecture guide so later scanner work can consume one canonical rules module

Why:

- future enforcement work needs a stable machine-readable map of current source-root ownership before adding scanners or CI gates
- keeping this metadata in its own package avoids weakening the narrower responsibilities of existing shared packages such as `packages/config`

Docs updated:

- `docs/02-architecture.md`
- `docs/07-change-log.md`

## 2026-06-25 - Generalize Monthly Usage Storage Into A Generic Meter Model

Changed:

- refactored `packages/db/src/schema/identity.ts` so `organization_monthly_usage` stores a generic `meter_key` and `quantity` instead of an audit-specific `event_count`
- updated audit ingest and platform context reads to consume the new generic meter row while still using the `events` meter key for the current product
- introduced a reusable generic meter summary helper in `packages/domain/src/usage/*` and moved month-window helpers into `packages/domain/src/time/*`
- generated a backfill-safe migration that renames `event_count` to `quantity`, backfills `meter_key`, and updates the monthly uniqueness constraint

Why:

- the future SaaS boilerplate needs a usage model that can support different entitlements without assuming event volume is the universal unit
- this change keeps the current audit product behavior intact while removing the last obvious product-shaped usage column from the shared persistence layer

Docs updated:

- `docs/02-architecture.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-25 - Split Generic Onboarding Logic From Audit Milestones

Changed:

- refactored `packages/domain/src/onboarding/*` so the reusable onboarding helper now works from caller-provided step definitions and completed-at maps instead of hardcoded audit milestone ids
- moved the current `project_created`, `api_key_created`, `first_event_ingested`, and `member_invited` definitions into `packages/domain/src/audit-events/onboarding.ts`
- rewired the platform repo and API schema registration to consume the audit-specific onboarding catalog while keeping the public `/api/v1/me` response shape unchanged

Why:

- a future SaaS boilerplate cannot have audit-product milestone names embedded in its generic domain layer
- this keeps today’s audit product behavior intact while creating a clean product-owned seam for later extraction

Docs updated:

- `docs/02-architecture.md`
- `docs/07-change-log.md`

## 2026-06-25 - Mark Repo Boundaries For Future Boilerplate Extraction

Changed:

- added an explicit `platform-core`, `platform-extension`, and `audit-product` classification to the architecture docs
- documented which current modules are intended to move into a future SaaS boilerplate repo and which should remain audit-specific
- called out current mixed areas such as `packages/domain`, `packages/db`, event-shaped usage metering, and onboarding milestone definitions as refactor targets before extraction

Why:

- the project should remain a focused audit product today while still being shaped so later extraction into a generic SaaS boilerplate is deliberate and low-risk
- making the intended split explicit now prevents accidental audit-specific dependencies from leaking into reusable platform layers

Docs updated:

- `docs/02-architecture.md`
- `docs/07-change-log.md`

## 2026-06-25 - Dedicated Getting-Started Onboarding Slice

Changed:

- added a reusable onboarding progress model in `packages/domain` and used it to extend `/api/v1/me` membership context with derived setup progress
- persisted only per-user per-organization dismissal state in `user_organization_onboarding_states`, while keeping milestone completion derived from existing projects, API keys, invitations, and audit events
- added `POST /api/v1/organizations/:organizationId/onboarding-state` for signed-in members to dismiss or restore the sidebar entry
- added a dedicated `/getting-started` page and onboarding feature in the web app, reusing existing settings and API-key flows instead of duplicating setup forms
- updated the dashboard shell and setup-related empty states to prefer the onboarding route when required setup is still incomplete

Why:

- the boilerplate needs one reusable operator-facing setup path instead of scattering the first-run journey across settings and empty states
- onboarding progress should remain cheap, deterministic, and analytics-friendly by deriving timestamps from real product milestones rather than persisting duplicated step state

Docs updated:

- `README.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/07-change-log.md`

## 2026-06-25 - Organization Pricing And Monthly Event Quotas

Changed:

- added a pure pricing catalog in `packages/domain` with the `starter`,
  `growth`, and `scale` plans plus UTC month-window helpers
- persisted organization-selected plan ids in `organizations.plan_id` and
  monthly usage counters in `organization_monthly_usage`
- extended `/api/v1/me` with per-organization pricing summaries and added a
  session-protected plan-change route for owners and admins
- enforced monthly included-event quotas only on public ingest, returning
  `402 event_quota_exceeded` while leaving dashboard and session-scoped reads available
- added a Plan & usage section to workspace settings with read-only visibility
  for members and viewers and manual plan switching for owners and admins

Why:

- pricing policy needs to live in code while usage state stays cheap to read and
  update at the Postgres boundary
- quota enforcement must be atomic on ingest without degrading normal dashboard
  reads or requiring raw-event recounts on every request

Docs updated:

- `README.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-20 - Minimal Audit Events Volume Chart

Changed:

- replaced the audit-events timeseries panel with a minimal single-series area chart
- kept the dashboard data flow unchanged while formatting chart axes and tooltips from the existing timeseries payload
- added empty-state handling so the chart card stays readable when no activity exists yet

Why:

- the dashboard needs a compact volume view that fits the new minimal visual direction without adding extra controls or chart clutter

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Permission-Aware Settings Actions

Changed:

- hid project-creation and member-invitation actions behind disabled settings forms for member and viewer roles
- passed the active organization role through the settings page so the UI can match the backend permission model
- kept organization creation and read-only settings context visible for all signed-in users

Why:

- the backend already restricts project creation and invitations to owner/admin roles, so the settings UI must not surface those actions as if they were available to everyone

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Permission-Aware API Key Management

Changed:

- passed the active organization role through the shared workspace resolver
- hid API key create and revoke actions on the dedicated API keys page for member and viewer roles
- kept listing access intact so lower-privilege users can still view project keys without being offered forbidden actions

Why:

- the API correctly restricts create and revoke to owner/admin roles, so the page must match that permission model instead of surfacing actions that always fail

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - API Key Management Moved Off Settings

Changed:

- removed the API keys management section from the settings page and its settings-side sub-navigation entry
- kept API key management on the dedicated `/api-keys` page only
- changed API key revoke on the dedicated page to use a bound server action instead of hidden-input form parsing

Why:

- key management now has its own page, so duplicating create and revoke controls inside settings added noise without helping the workflow
- binding the revoke action directly makes the submit path more explicit and fixes the unreliable revoke click behavior

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Dedicated API Keys Page

Changed:

- added a dedicated `/api-keys` page in the web app with a table-first API key management screen
- added sidebar navigation for API keys while preserving the active workspace query context
- updated API-key create and revoke actions so forms can return either to settings or to the dedicated API-keys page

Why:

- project API keys now have enough operational detail to deserve a dedicated page instead of living only inside settings
- keeping the page on the same workspace loader avoids a second inconsistent API-key loading path

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Minimal Sidebar Pass

Changed:

- removed extra sidebar card framing around navigation and workspace controls
- reduced sidebar copy and tightened the left-rail spacing and typography
- kept the same route-driven workspace switch behavior while making the rail read more like a utility column

Why:

- the previous shell was still visually heavier than needed for a minimal operator dashboard
- the sidebar now puts emphasis on navigation and context with fewer decorative layers

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Simplified Dashboard Styling Toward The OpenAI Platform Dashboard

Changed:

- reduced the dashboard shell chrome by flattening cards, removing gradients, and using quieter neutral tokens
- simplified section headers, filter panels, workspace summary surfaces, and navigation affordances
- kept the existing workspace behavior and coverage while shifting the interface toward a calmer operator dashboard style

Why:

- the previous refresh added too much decorative weight for a product surface that should feel closer to a restrained control panel
- the dashboard and settings pages now prioritize hierarchy, spacing, and typography over badges, shadows, and gradients

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Immediate Sidebar Workspace Switching And Shadcn-Style Shell Refresh

Changed:

- made the sidebar organization and project controls update the current route immediately instead of waiting for a second submit action
- synced the switcher client state back to the active URL-backed workspace so re-renders and reloads keep the visible selection stable
- refreshed shared web primitives and the dashboard or settings shell with more polished card, filter, table, and summary surfaces

Why:

- restore the expected workspace-switch behavior where the selected org and project become the current page context right away
- remove the stale local-state path that made the sidebar selection appear to reset after navigation or reload
- move the shell closer to the intended modern dashboard style without introducing a large external dependency path

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Web UI Coverage Gate For The Dashboard Slice

Changed:

- added a dedicated `pnpm --filter web test:ui` command that enforces 90% coverage for the current dashboard, settings, members, and shell UI slice
- added branch-focused tests for the sidebar shell, workspace switcher, settings fallback path, and dialog-driven event inspection close path

Why:

- make the new UI work fail fast when coverage drops below the required floor
- avoid claiming whole-app web coverage that the current repo does not yet meet

Docs updated:

- `docs/04-quality-gates.md`
- `docs/07-change-log.md`

## 2026-06-20 - Organization Members Page

Changed:

- added a session-protected organization members endpoint for the active workspace
- added a `/members` page in the web app and linked it from the sidebar shell
- reused the active organization context for member reads and added empty-state coverage

Why:

- expose the current organization roster without forcing workspace admins into the API directly
- keep member browsing aligned with the same org and project selection model used by the dashboard and settings pages

Docs updated:

- `docs/03-api.md`
- `docs/07-change-log.md`

## 2026-06-20 - Sidebar Dashboard Shell

Changed:

- replaced the top app header with a left sidebar shell for dashboard and settings navigation
- added a bottom workspace switcher that updates the current route with the selected organization and project context
- added layout tests for the sidebar shell and switcher behavior
- split the settings screen into smaller feature components so the web architecture gate remains green

Why:

- keep primary navigation and workspace context persistent while freeing the main canvas for dashboard and settings work
- align the shell with the repo rule that feature components stay small and composable

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Settings Sub-Navigation For Workspace Management

Changed:

- added an inner settings navigation that jumps between workspace, access, project, and API-key sections
- regrouped the settings forms and supporting cards so invitations, project setup, and key management are separated by concern
- added settings-screen tests that cover the new navigation targets and invitation-link empty state

Why:

- reduce scanning on the settings page by turning one long stack into clear management sections
- make workspace administration tasks easier to find before the broader dashboard shell changes land

Docs updated:

- `docs/07-change-log.md`

## 2026-06-20 - Modal Event Inspection On The Dashboard

Changed:

- replaced the inline event detail card with an on-demand modal inspection flow
- added a shared web dialog primitive using the existing Radix dialog dependency
- updated dashboard interaction tests to cover modal open, close, and fallback rendering behavior

Why:

- keep the event stream focused until a user explicitly inspects one event
- reduce dashboard layout pressure before the larger sidebar and settings UX changes land

Docs updated:

- `docs/07-change-log.md`

## 2026-06-18 - Refresh Dashboard And Settings UX

Changed:

- added a workspace summary card to the settings page with current organization, project, and key counts
- grouped settings affordances into clearer orientation, workspace, project, and key sections
- improved empty-state copy on the dashboard, project list, and API key list to point at the next step
- made the organization switcher and project list show the active selection more explicitly

Why:

- reduce the amount of scanning required to understand the selected workspace
- make the settings page feel like a workspace home instead of a raw form stack
- keep the dashboard connected to the setup flow when there are no events yet

Docs updated:

- `docs/07-change-log.md`

## 2026-06-18 - Ignore Blank Dashboard Filter Inputs

Changed:

- normalized empty dashboard query-string values to `undefined` before Zod parsing
- added a regression test for submitting the event, actor, and target filters with blank inputs

Why:

- prevent the dashboard filter form from throwing on untouched inputs during a GET submit
- preserve the existing validation rules for non-empty values while treating empty form fields as absent

Docs updated:

- `docs/07-change-log.md`

## 2026-06-18 - Simplify To The Core MVP Slice

Changed:

- removed the disconnected exports backend and web feature code
- removed Redis from the active runtime env contract and compose stacks
- removed dead web runtime code, Storybook, Playwright smoke coverage, and unused dependencies
- narrowed standard auth runtime config to provider-backed sender selection only while keeping the explicit local-auth harness

Why:

- keep the production code path limited to sign-in, workspace management, project API keys, ingest, and dashboard reads
- remove side systems and optional branches that increased maintenance cost without serving the hosted MVP
- make local and deployment setup match the currently implemented runtime surface

Docs updated:

- `README.md`
- `docs/01-agent-engineering-rules.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/04-quality-gates.md`
- `docs/05-next-steps.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`
- `apps/web/README.md`

## 2026-06-18 - Remove Seeded Local API Key

Changed:

- stopped `pnpm db:seed` from creating a fixed local API key by default
- changed local API examples to require a dashboard-created project API key
- kept explicit seed-time API key insertion available only for internal callers such as tests

Why:

- remove a machine-credential path that bypassed the dashboard-managed API key workflow
- make local and deployed usage follow the same project API key lifecycle

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Session-Scoped Dashboard Event Reads

Changed:

- moved dashboard audit-event reads off the global web API key path
- added session-authenticated project-scoped event read routes for the web app
- preserved selected organization and project context across dashboard and settings links

Why:

- ensure events written with a newly created project API key appear in the same project's dashboard
- remove the mismatch where the web UI could read a different project's data through one configured machine key

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/07-change-log.md`

## 2026-06-18 - Auth Runtime And Workspace Hardening

Changed:

- made standard API runtime require a provider-backed magic-link sender
- moved local fake magic-link delivery to an explicit dev-only auth harness entrypoint
- centralized workspace resolution for dashboard, settings, and app navigation
- made flashed API-key state one-shot and workspace-scoped
- stopped treating arbitrary auth API failures as anonymous sessions in the web app

Why:

- remove embedded runtime fallbacks that could blur development and production behavior
- keep org/project selection deterministic across dashboard and settings flows
- surface real auth/runtime failures instead of silently degrading them into sign-out behavior

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`
- `apps/api/src/modules/auth/README.md`
- `apps/web/README.md`

## 2026-06-18 - Web Container Prebuild

Changed:

- moved the `web` production build into the root Docker image build
- changed the web runtime command to serve the prebuilt Next.js output only
- added a dedicated root build script so the Docker image and repo command stay aligned
- replaced the remote Google font fetch with local system font stacks so the
  container build can run offline

Why:

- keep container startup focused on serving the app instead of compiling it
- make the deployed runtime match the production build artifact instead of rebuilding on boot
- avoid build failures in containerized environments without external font access

Docs updated:

- `README.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Low-Context Agent Quickstart

Changed:

- added a compact agent quickstart with repo map, cheap read paths, and command shortlist
- linked repo entry-point docs to the quickstart for low-context work
- replaced the generic `apps/web/README.md` boilerplate with project-specific guidance

Why:

- reduce context cost for smaller models and narrow task-oriented runs
- keep agents from wasting tokens on broad scans or framework boilerplate

Docs updated:

- `README.md`
- `docs/01-agent-engineering-rules.md`
- `docs/07-change-log.md`
- `docs/08-agent-quickstart.md`
- `apps/web/README.md`

## 2026-06-18 - Auth Sender Config Hardening

Changed:

- added an explicit `AUTH_MAGIC_LINK_SENDER` config selector for API runtime auth
- reserved `resend` as the first provider-backed sender contract with validated
  `AUTH_RESEND_API_KEY` and `AUTH_RESEND_FROM_EMAIL` env values
- made production config reject the local logging sender and missing sender selection

Why:

- prevent production auth startup from silently using a non-delivery local sender
- validate provider-specific email requirements before runtime wiring begins

Docs updated:

- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Resend Auth Sender Adapter

Changed:

- added a concrete Resend-backed magic-link sender adapter in the auth module
- kept the auth service boundary unchanged by continuing to depend on `MagicLinkSender`
- added sender tests for successful Resend requests and provider error handling

Why:

- provide the first production-capable email delivery implementation behind the existing auth boundary
- keep runtime wiring separate from provider behavior so sender selection can be tested independently

Docs updated:

- `apps/api/src/modules/auth/README.md`
- `docs/07-change-log.md`

## 2026-06-18 - Auth Runtime Sender Selection

Changed:

- updated runtime auth startup to select the Resend sender when configured
- kept the in-memory logging sender as the non-production fallback path
- added app-level tests for provider selection and local fallback behavior

Why:

- make startup wiring honor the validated sender config without changing the auth service boundary
- preserve the local sign-in workflow for development and test environments

Docs updated:

- `apps/api/src/modules/auth/README.md`
- `docs/03-api.md`
- `docs/06-deployment.md`
- `docs/07-change-log.md`

## 2026-06-18 - Alias-Only Imports In Web

Changed:

- rewrote local `apps/web` imports and re-exports to use the `@/...` alias
- added an ESLint restriction that rejects `./` and `../` local imports in `apps/web`
- documented the alias-only import rule in the web architecture and quality gates

Why:

- keep moves and refactors from churning deep relative import paths
- make module ownership and cross-feature boundaries easier to scan during review

Docs updated:

- `docs/02-architecture.md`
- `docs/04-quality-gates.md`
- `docs/07-change-log.md`

## 2026-06-18 - Task Tracking Workflow Bootstrap

Changed:

- made the `tasks/` directory the canonical task tracker
- added category-scoped task files under `tasks/`
- added `scripts/task-sync.sh` for local task validation
- added hard task workflow rules to `AGENTS.md` and `docs/01-agent-engineering-rules.md`

Why:

- keep task history inside the repository where the agent can update it deterministically
- avoid agents inventing hidden state outside `tasks/*.txt`

Docs updated:

- `README.md`
- `docs/01-agent-engineering-rules.md`
- `docs/07-change-log.md`

## 2026-06-18 - Narrow Hosted MVP Path

Changed:

- added a dedicated `api-keys` backend slice with service, Postgres adapter, and tested Fastify routes
- extended the web `/settings` flow to support project selection, API key creation, API key revocation, and first-event onboarding
- added a dashboard empty state that points users back to the onboarding path
- updated Coolify deployment to describe `web` and `api` as one hosted MVP stack

Why:

- the project already had enough platform surface to be useful, but it still lacked the machine credential workflow needed for real adoption
- the fastest path to usefulness is a single hosted ingest-to-investigate slice, not a broader unfinished platform surface

Docs updated:

- `README.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/04-quality-gates.md`
- `docs/06-deployment.md`

## 2026-06-17 - API Contract Hardening

Changed:

- added OpenAPI generation at `/api/v1/openapi.json`
- centralized shared request and response schemas
- centralized API error formatting
- made `/api/v1` the only supported API contract path

Why:

- keep runtime contract, tests, and docs derived from the same source
- reduce drift between implementation and documentation

Docs updated:

- `README.md`
- `docs/03-api.md`
- `docs/04-quality-gates.md`

## 2026-06-17 - Audit Event Route Refactor

Changed:

- split `audit-events/routes.ts` into smaller source-adjacent modules:
  - `http-contract.ts`
  - `query.ts`
  - `presenters.ts`
  - `request-principal.ts`
- kept route registration thin and pushed pure logic into directly testable helpers

Why:

- make route code smaller
- keep helpers pure and easier to test
- keep ownership boundaries obvious for future agents and contributors

Docs updated:

- `README.md`
- `docs/04-quality-gates.md`

## 2026-06-17 - Colocated Test Layout

Changed:

- moved tests next to the code they cover under local `__tests__` directories
- changed integration discovery to `src/**/__tests__/**/*.integration.test.ts`
- updated package and app TypeScript test includes to follow the colocated layout

Why:

- keep file ownership clearer
- make code and tests easier to change together
- reduce the top-level test bucket effect

Docs updated:

- `README.md`
- `docs/04-quality-gates.md`

## Web Frontend Architecture Baseline

Established `apps/web` as a pure Next.js UI that consumes the existing
`apps/api` Fastify service. The frontend must not add Next.js route handlers or
API endpoints. The initial audit-events vertical slice follows the API app's
thin adapter, service, boundary-validation, and presenter patterns.

Expanded the web audit-events slice with server-loaded filters, cursor
pagination, event stats, and timeseries charting. Browser refetching remains
deferred until the API has an explicit browser-session principal model.

Hardened the web architecture by moving page data composition into an injectable
feature server loader, constraining API paths with generated OpenAPI contract
types, and expanding architecture checks for component and server/client
boundaries.

Introduced a Tailwind-first UI system for `apps/web`. Repeated visual patterns
now live in small shared primitives, audit-event feature components compose those
primitives directly, and global CSS is limited to Tailwind import, semantic
tokens, reset, and base body styles.

Started the production platform foundation with pure API services for custom
magic-link auth, organizations/projects/invitations, and async export jobs. The
web app now has matching feature boundaries for auth, organizations,
invitations, and exports. Fastify routes and persistence are intentionally left
for the next tested vertical slice.

Added the first tested auth route adapter for magic-link requests, session
creation, logout, and current-user lookup. The web auth client now targets those
API paths directly and the shared API client includes credentials for
cookie-backed browser sessions.

Added the first platform persistence layer: Drizzle schema and migration for
users, magic links, sessions, organization memberships, invitations, and export
jobs, plus Postgres repository adapters for auth, platform, and export services.
Route registration remains deferred until auth/email/cookie config is wired.

Added the auth email delivery boundary with an in-memory sender for development
and tests, added auth-specific environment validation, documented the magic-link
URL contract, and allowed `buildApp()` to register auth routes through an
explicit injected `AuthService`.

Added browser session principal resolution with `sessionAuthPlugin` and expanded
`/me` to support real organization/project membership context through an
injectable platform context service. Machine API-key authentication remains
separate for ingestion routes.

Added the first organizations/projects API slice with role-checked platform
service methods, Postgres repo support for membership/project lookups, and
tested Fastify route adapters for organization and project management.

Added the invitations API slice with token hashing, invite/accept/revoke service
methods, Postgres repo support for invitation lookup and state updates, and
tested route adapters for invitation lifecycle operations.

Added the exports backend slice with export status transitions, in-memory object
storage, CSV generation, pending-job worker processing, and tested routes for
creating, listing, checking, and downloading completed exports.

Added the first web browser-auth slice. The Next.js app now has sign-in,
magic-link sent, callback, logout, and protected-shell flows that call the
existing Fastify API directly. The shared web API client supports raw responses
for cookie exchange and server-side cookie forwarding for `/api/v1/me`, while
the no-Next-route-handlers boundary remains intact.

Mounted auth routes in runtime API infrastructure mode. `buildApp({
useInfrastructure: true })` now creates the Postgres auth repo, platform context
service, auth service, and local magic-link sender, then registers browser auth
routes under `/api/v1`. Non-production startup logs generated magic-link URLs
for local testing.

Fixed migration metadata for the platform foundation migration so
`drizzle-kit migrate` discovers `0001_platform_foundation.sql` on fresh
databases instead of requiring manual SQL application.

Added the first web organization/project management slice. Runtime API
infrastructure mode now registers session auth and platform routes from the
Postgres platform service. The web app has a protected `/settings` screen for
organization creation, project creation, invitation-token creation, and
invitation acceptance, all through direct Fastify API calls.

Fixed magic-link lookup for repeated sign-in attempts. The Postgres auth repo
now resolves the newest magic link for an email address, preventing older
consumed or expired links from causing fresh callback tokens to fail.

Changed the web invitation workflow to display a full invitation URL after
creating an invite, instead of exposing only the raw token.

Fixed platform membership lookup after invitation acceptance. The Postgres
platform repo now queries memberships by organization and user together, so
project listing works for newly invited users even when the organization already
has other members.

Made organization membership idempotent for invitation acceptance. The platform
service now returns an existing membership instead of creating a duplicate, the
database migration adds a unique organization/user membership index after
removing duplicates, and `/me` context loading defensively deduplicates stale
duplicate rows.

Hardened database behavior for invitations and exports. Pending invitations are
now unique per organization/email, invitation acceptance verifies the signed-in
user email, and export listing/worker pickup uses deterministic ordering.
## 2026-06-25 - Browser Form Compatibility For Auth Redirect Routes

Changed:

- taught the auth route adapter to accept `application/x-www-form-urlencoded` browser form posts
- added route tests that cover real browser-style confirm and logout submissions

Why:

- prevent logout and callback confirmation from failing with `415 Unsupported Media Type`
- keep the API-owned auth redirect flow compatible with normal HTML forms

Docs updated:

- `docs/03-api.md`

## 2026-06-25 - Shared-Domain Auth Cookie Redirect Flow

Changed:

- replaced the Next.js callback cookie-mirroring step with API-owned browser redirect endpoints for sign-in confirmation and sign-out
- added `AUTH_SESSION_COOKIE_DOMAIN` so production `app.*` and `api.*` subdomains can share one HttpOnly session cookie
- updated the web callback and logout forms to post directly to the API public origin while keeping page protection on `/api/v1/me`

Why:

- remove fragile cross-origin `Set-Cookie` mirroring logic from the web app
- keep one session authority and one browser cookie across the deployed web and API origins
- make production auth behavior match the browser’s normal cookie and redirect model

Docs updated:

- `README.md`
- `docs/02-architecture.md`
- `docs/03-api.md`
- `docs/06-deployment.md`

## 2026-06-18 - Task Directory Split

Changed:

- replaced the single `tasks.txt` file with category-scoped files under `tasks/`
- moved existing open work into per-category task files
- moved workflow history into `tasks/workflow.txt`
- updated repository docs to reference `tasks/*.txt` instead of `tasks.txt`

Why:

- keep each task file small and focused enough to scan quickly
- make task ownership and category boundaries explicit in the repository

Docs updated:

- `README.md`
- `AGENTS.md`
- `docs/01-agent-engineering-rules.md`
- `docs/07-change-log.md`
