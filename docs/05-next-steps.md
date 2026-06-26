# Next Steps

Keep the build vertical and incremental.

## Recommended Order

1. Prepare extraction inputs without extracting yet:
   - keep `tools/extraction/manifest.ts` current as the canonical advisory split
   - add dry-run extraction tooling only after mixed paths have been reduced further
   - keep future extraction fail-closed on unknown paths

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
