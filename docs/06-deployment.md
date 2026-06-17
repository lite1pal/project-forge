# Deployment

Deploy AuditTrail to Coolify as one Docker Compose stack with three services:

- `api`
- `postgres`
- `redis`

That keeps the deployment unit together without putting multiple long-running processes into one container.

## Coolify setup

Create one Docker Compose application in Coolify and point it at:

```text
docker-compose.coolify.yml
```

Exposed API port:

- `4000`

The stack uses internal service hostnames:

- Postgres hostname: `postgres`
- Redis hostname: `redis`

The API container already runs migrations on startup before the server boots.

## Required environment variables

Add this in Coolify:

```text
API_KEY_PEPPER=<generate-a-long-random-secret>
```

Example:

```text
API_KEY_PEPPER=3f7c2f4d1a9e8b6c0d5f2a7b1c9e4d6f
```

Everything else is already defined in `docker-compose.coolify.yml`:

```text
NODE_ENV=production
API_HOST=0.0.0.0
API_PORT=4000
PORT=4000
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
DATABASE_URL=postgres://auditrail:auditrail@postgres:5432/auditrail
REDIS_URL=redis://redis:6379
```

## Stack behavior

- `api` builds from the root `Dockerfile`
- `postgres` uses `postgres:17-alpine`
- `redis` uses `redis:7-alpine`
- Postgres data is persisted in `postgres-data`
- Redis data is persisted in `redis-data`
- `api` waits for healthy Postgres and Redis before starting

## Deploy flow

1. Push changes to the connected git branch.
2. Coolify rebuilds the stack from `docker-compose.coolify.yml`.
3. Coolify starts `postgres` and `redis`.
4. Coolify starts `api`.
5. The API container runs `pnpm db:migrate`.
6. The API starts on port `4000`.

## Health check

Container health is based on:

```text
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Notes

- `PORT` is supported as a fallback for platforms that inject it automatically.
- `TEST_DATABASE_URL` is not used in production.
- This stack is for deployment. Local development should keep using `docker-compose.yml`.
## Platform Runtime Requirements

The production platform layer will require explicit environment configuration
for:

- auth token hashing secret
- session cookie name, domain, secure flag, and TTL
- email provider credentials for magic links
- public web app URL for magic-link redirects
- S3-compatible object storage endpoint, bucket, region, and credentials
- export worker concurrency and retry settings

No secret should be exposed through `NEXT_PUBLIC_*`.
