# Next Steps

Keep the build vertical and incremental.

## Recommended Order

1. Add event search filters:
   - event type
   - actor
   - target
   - created date range

2. Add dashboard read model:
   - recent events
   - event count
   - top event types

3. Add web dashboard:
   - call `GET /v1/events`
   - show recent event table
   - add event detail drawer

4. Add queue package and worker:
   - BullMQ
   - Redis connection
   - `audit-event.created` job
   - placeholder webhook delivery processor

5. Add export jobs:
   - CSV export
   - date-range filters
   - background job status

6. Add tamper-evident hash chain:
   - previous hash
   - event hash
   - verification endpoint or job

## Not Yet

Do not add these before the dashboard and queue slice are working:

- ClickHouse
- billing
- SSO
- Kubernetes
- published SDK packages
- complex RBAC

