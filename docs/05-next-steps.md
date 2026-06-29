# Next Steps

Keep the build vertical and incremental.

## Recommended Order

1. Keep extraction prep local and fail-closed:
   - keep `tools/extraction/manifest.ts` current as the canonical advisory split
   - keep `tools/extraction/dry-run.ts` green as the fail-closed plan check
   - use `tools/extraction/extract.ts` only for ignored local candidate output
   - keep `tools/extraction/validate-placeholder-product.ts` green as the scaffold-validation step for placeholder product wiring
   - keep `packages/framework` limited to pure framework contract vocabulary until a later task adds read-only planning or validation consumers
   - reduce mixed and manual-review paths before treating any generated output as reusable
   - keep future extraction fail-closed on unknown paths

1. Build the first tooling consumers on top of the framework contract layer:
   - read framework module/resource/check definitions from `packages/framework`
   - keep the canonical resource-spec schema in `packages/framework` as the source of truth for future resource planners and generators
   - keep `pnpm saas doctor` green as the first read-only framework CLI health check
   - keep `pnpm saas plan resource ...` green as the read-only resource planner contract
   - keep `pnpm saas add resource ... --output ...` green as the first preview-only CRUD generator for one narrow organization-owned resource
   - keep `pnpm saas agent context resource ...` green as the first AI-agent context compiler for generated-resource tasks
   - keep `pnpm saas check generators` green so generated-resource output stays reproducible and reviewable through committed golden fixtures
   - keep `pnpm saas check generated-resource` green so fixture output is proven structurally usable in isolated preview form before any real runtime registration work
   - keep `pnpm saas apply resource ... --target ...` green as the first opt-in isolated apply path while central runtime patching stays fail-closed

1. After `saas doctor`, add the next framework tooling slices in order:
   - richer doctor checks driven directly from framework contract metadata
   - harden generated-resource apply so API runtime registration and migration seams can be patched safely instead of falling back to manual review
   - broaden CRUD/resource generator support beyond the first org-owned subset only after the golden-fixture check stays stable across intentional updates
   - harden the agent-context output so future tooling can consume it as stable machine-readable metadata

1. Add dashboard read model:
   - recent events
   - event count
   - top event types

This is now partially implemented through:

- `GET /api/v1/events`
- `GET /api/v1/events/stats`

The next API-only extension should prefer one of:

1. event-count time buckets for charts
1. top actors / top targets summaries
1. saved filter presets

1. Add richer event filters only if backed by indexes or clear product need:
   - environment
   - project id for internal admin views
   - actor/target type if introduced into the schema

1. Add web dashboard:
   - call `GET /api/v1/events`
   - show recent event table
   - add event detail drawer

1. Add queue package and worker:
   - BullMQ
   - `audit-event.created` job
   - placeholder webhook delivery processor

1. Add tamper-evident hash chain:
   - previous hash
   - event hash
   - verification endpoint or job

1. Harden container runtime:
   - run compiled JavaScript instead of `tsx` source
   - reduce image size
   - remove dev dependencies from runtime
   - clean up workspace package builds first
   - keep the Coolify stack shape unchanged while doing this; only harden the `api` image/runtime

## Not Yet

Do not add these before the dashboard and queue slice are working:

- ClickHouse
- billing
- SSO
- Kubernetes
- published SDK packages
- complex RBAC
