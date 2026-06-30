# Operations

This runbook describes the current Coolify + Postgres + API + Web + Worker
production shape honestly. It does not assume backup automation,
object storage, or secret-management tooling that the repo does not yet have.

## Current Production Shape

The current hosted runtime is:

- `web`
- `api`
- `worker`
- `postgres`

The API and worker containers still boot through source-runtime commands
instead of compiled start paths. Treat that as a known runtime limitation when
diagnosing startup or image-size issues; do not assume those containers are
already hardened beyond the current documented flow.

## Environment Checklist

Before a production deploy, verify these values are set and aligned:

- `DATABASE_URL` points at the production Postgres instance
- `API_KEY_PEPPER` is a long random secret
- `AUTH_TOKEN_SECRET` is a long random secret
- `AUTH_MAGIC_LINK_SENDER=resend`
- `AUTH_RESEND_API_KEY` and `AUTH_RESEND_FROM_EMAIL` are set together
- `AUTH_SESSION_COOKIE_DOMAIN` matches the parent domain for split `app.*` and `api.*` origins
- `AUTH_SESSION_COOKIE_SECURE=true` in production
- `WEB_PUBLIC_URL` matches the externally reachable web URL used in magic links
- `API_PUBLIC_URL` and `NEXT_PUBLIC_API_BASE_URL` both point at the browser-reachable API origin
- `API_HOST=0.0.0.0`, `API_PORT=4000`, `PORT=4000`, `NODE_ENV=production`
- `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` are set to the intended production policy
- if billing checkout or portal should be live, `BILLING_PROVIDER` and any
  provider-specific env such as the Stripe keys or price IDs are aligned

Current defaults from the repo are:

- `RATE_LIMIT_MAX=100`
- `RATE_LIMIT_WINDOW=1 minute`
- `AUTH_SESSION_COOKIE_NAME=auditrail_session`
- `AUTH_MAGIC_LINK_TTL_SECONDS=900`
- `AUTH_SESSION_TTL_SECONDS=2592000`

Current production deployment does not use object storage, so there are no
object-storage env vars to configure yet. Do not put secrets into any
`NEXT_PUBLIC_*` variable.

The current Coolify stack uses the internal Postgres hostname `postgres` and
the database name/user `auditrail`. The `postgres-data` volume is the only
durable storage in the stack.

## Backup And Restore

The hosted stack keeps Postgres data in the `postgres-data` volume. That means
backups are a manual operator responsibility today.

Take a logical backup before any risky deploy or migration:

```bash
docker compose -f docker-compose.coolify.yml exec -T postgres \
  pg_dump -U auditrail -d auditrail -Fc > auditrail-YYYY-MM-DD.dump
```

For a plain SQL dump, use `pg_dump` without `-Fc` and restore with `psql`
instead of `pg_restore`.

Restore into the target database only when you intend to replace it:

```bash
docker compose -f docker-compose.coolify.yml exec -T postgres \
  pg_restore -U auditrail -d auditrail --clean --if-exists < auditrail-YYYY-MM-DD.dump
```

Restore safety notes:

- stop or pause API traffic before restoring
- restore into an isolated database first if you need to inspect the dump
- do not partially edit live production tables as a substitute for restore
- redeploy the matching app version after restoring if the code and schema need
  to line up again

Verify the restored stack with:

- `GET /health` on the API
- a known good authenticated API or browser-session request
- the web container health check
- the Postgres container health check

What is not automated yet:

- scheduled database backups
- snapshot orchestration in Coolify
- one-click restore
- restore drills

## Secret Rotation

Rotate secrets deliberately. There is no current dual-secret rotation support,
so several changes invalidate existing credentials immediately.

- `API_KEY_PEPPER` invalidates all existing project API keys because API keys
  are hashed with that pepper
- `AUTH_TOKEN_SECRET` invalidates all stored session tokens and outstanding
  magic links because both use that secret for hashing
- `AUTH_RESEND_API_KEY` and `AUTH_RESEND_FROM_EMAIL` do not invalidate
  existing sessions or API keys, but they can break magic-link delivery if the
  provider values are wrong
- `AUTH_SESSION_COOKIE_DOMAIN` is not a secret, but changing it can make
  existing browser cookies stop matching the deployed domain shape

Safe order when you need to rotate the full auth stack:

1. Update and verify the provider email settings first.
2. Rotate `AUTH_TOKEN_SECRET` during a window where users can re-authenticate.
3. Rotate `API_KEY_PEPPER` last, then reissue every project API key.

If you rotate `AUTH_TOKEN_SECRET`, expect active browser sessions and pending
magic links to stop working. If you rotate `API_KEY_PEPPER`, expect all API
keys to stop working immediately.

## Migration Rollback Policy

Migrations are forward-first in this repo.

- take a database backup before applying a production migration
- validate schema changes against a throwaway database with
  `pnpm db:create:test && pnpm db:migrate:test`
- keep `pnpm verify` green before deploying
- the API container runs `pnpm db:migrate` on startup, so production deploys
  pick up applied migrations automatically
- do not manually edit applied migration history in production
- do not rely on an untested down migration unless one already exists and has
  been exercised in the repo

If a migration is already applied and a rollback is needed, the safe default is
to restore the database from backup and redeploy the matching app version. Use
code rollback alone only when the schema change is known to be backward
compatible.

## Rate Limit Policy

The API rate limit is controlled by:

- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW`

Current defaults are `100` requests per `1 minute`. The `/health` endpoint is
exempt so infrastructure checks do not consume API quota.

When customers report `429` responses:

1. capture the `x-request-id` from the response
2. check the API structured logs for the same request ID
3. confirm whether the traffic is hitting a single route, a retry loop, or a
   proxy that is reusing one client identity
4. compare the failing request volume with `RATE_LIMIT_MAX` and
   `RATE_LIMIT_WINDOW`
5. check whether the rate limit is coming from the API or from an upstream
   proxy or CDN

Do not loosen the global API limit or exempt new routes without product and
security review. The public ingest route and auth flows should be treated as
security-sensitive by default.

## Incident Debugging Flow

Start with the lowest-risk checks:

1. `GET /health`
2. API container status in Coolify
3. worker container status in Coolify
4. web container status in Coolify
5. Postgres health and volume availability

If the issue is request-specific, use the request ID:

- the API returns `x-request-id` on responses
- the same ID appears in the structured request logs
- use that ID to follow one failing request end to end

Then check the recent change window:

- the last deployment commit
- whether the API container started migrations on boot
- whether a migration applied just before the incident
- whether the request is failing with `429`, auth errors, or generic internal
  errors

When investigating auth or rate-limit failures:

- confirm the expected `AUTH_*` values are present in the environment
- verify the email provider can still send magic links
- inspect whether browser sessions were invalidated by a secret rotation

When using internal support lookup routes:

- treat them as read-only troubleshooting tools, not as a data-export path
- confirm the caller is an internal support or admin user before investigating
- do not copy raw response payloads into incident notes if they include personal
  email addresses or billing summaries
- do not expect support lookup to bypass normal product route membership checks

Do not log or share:

- `API_KEY_PEPPER`
- `AUTH_TOKEN_SECRET`
- `AUTH_RESEND_API_KEY`
- session cookies
- API keys
- magic-link tokens

Preserve evidence before restoring from backup:

- save the request ID
- record the deployment SHA or Coolify revision
- capture the time window of the incident
- export the relevant logs

Only move to restore-from-backup after the evidence is captured and the scope of
the incident is clear.

When investigating ingest lag or missing async completion:

- check whether `job_outbox` rows are accumulating in `pending` or `failed`
  states
- confirm the worker container is running and restarting cleanly
- inspect worker logs for `worker_claim_failed`, `worker_job_failed`, or
  `worker_job_missing_handler`

When investigating webhook delivery failures specifically:

- check the target project webhook endpoint state in the settings UI
- inspect the latest delivery summary for HTTP status, retry count, and last error
- confirm the destination URL still accepts POST requests from the worker runtime
- verify the receiver is computing `HMAC-SHA256(<timestamp>.<raw-body>)` with the
  currently active endpoint secret
- rotate the webhook secret if you suspect receiver drift or secret exposure
