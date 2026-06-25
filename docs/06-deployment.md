# Deployment

Deploy AuditTrail to Coolify as one Docker Compose stack with three services:

- `web`
- `api`
- `postgres`

That keeps the deployment unit together without putting multiple long-running processes into one container.

## Coolify setup

Create one Docker Compose application in Coolify and point it at:

```text
docker-compose.coolify.yml
```

Exposed API port:

- `4000`

Exposed web port:

- `3000`

The stack uses internal service hostnames:

- Postgres hostname: `postgres`

The API container already runs migrations on startup before the server boots.
The Docker build uses the root `packageManager` pin and runs dependency
installation with `CI=true`, so hosted builds do not depend on implicit `pnpm`
resolution or interactive prompts.

## Required environment variables

Add this in Coolify:

```text
API_KEY_PEPPER=<generate-a-long-random-secret>
AUTH_TOKEN_SECRET=<generate-a-long-random-secret>
AUTH_SESSION_COOKIE_DOMAIN=example.com
API_PUBLIC_URL=https://api.example.com
WEB_PUBLIC_URL=https://app.example.com
```

Example:

```text
API_KEY_PEPPER=3f7c2f4d1a9e8b6c0d5f2a7b1c9e4d6f
AUTH_TOKEN_SECRET=cb2f4f7a6f7c1c24f10d6c8d0b4e0d51
AUTH_SESSION_COOKIE_DOMAIN=example.com
API_PUBLIC_URL=https://api.example.com
WEB_PUBLIC_URL=https://app.example.com
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
WEB_API_BASE_URL=http://api:4000
NEXT_PUBLIC_API_BASE_URL=${API_PUBLIC_URL}
```

The web image bakes `NEXT_PUBLIC_API_BASE_URL` from `API_PUBLIC_URL` during the
Docker build so the browser bundle points at the deployed API origin.

## Stack behavior

- `web` builds from the root `Dockerfile`, compiles during image build, and
  runs `pnpm start:web:container`
- `api` builds from the root `Dockerfile`
- `postgres` uses `postgres:17-alpine`
- Postgres data is persisted in `postgres-data`
- `api` waits for healthy Postgres before starting
- `web` waits for `api` before starting

## Deploy flow

1. Push changes to the connected git branch.
2. Coolify rebuilds the stack from `docker-compose.coolify.yml`.
3. Coolify starts `postgres`.
4. Coolify starts `api`.
5. The API container runs `pnpm db:migrate`.
6. Coolify starts `web`.
7. The web container serves the prebuilt Next.js app on port `3000`.

## Verification from the repository root

Use these commands to check the container runtime before or after deployment:

```bash
pnpm build:web:container
docker compose -f docker-compose.coolify.yml up --build
```

`pnpm build:web:container` validates the prebuilt web artifact path, and the
Compose command exercises the same stack definition Coolify uses in hosted
deployments.

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
- Protected API requests require project API keys created through the dashboard
  or API key management flow. Deployment and local seed setup do not provision a
  default machine credential.
- This stack is for deployment. Local development should keep using `docker-compose.yml`.
## Platform Runtime Requirements

The production platform layer will require explicit environment configuration
for:

- auth token hashing secret
- session cookie name, domain, secure flag, and TTL
- email provider credentials for magic links
- public web app URL for magic-link redirects
- S3-compatible object storage endpoint, bucket, region, and credentials

No secret should be exposed through `NEXT_PUBLIC_*`.

Current auth and hosted-MVP env variables:

- `AUTH_TOKEN_SECRET`
- `AUTH_MAGIC_LINK_SENDER`
- `AUTH_MAGIC_LINK_TTL_SECONDS`
- `AUTH_RESEND_API_KEY`
- `AUTH_RESEND_FROM_EMAIL`
- `AUTH_SESSION_TTL_SECONDS`
- `AUTH_SESSION_COOKIE_DOMAIN`
- `AUTH_SESSION_COOKIE_NAME`
- `AUTH_SESSION_COOKIE_SECURE`
- `WEB_PUBLIC_URL`
- `WEB_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`

The platform persistence migration is `packages/db/src/migrations/0001_platform_foundation.sql`.
Run database migrations before enabling auth route registration in production.
`packages/db/src/migrations/0002_unique_memberships.sql` removes duplicate
organization memberships and adds a uniqueness guarantee for
`organization_id + user_id`.
`packages/db/src/migrations/0003_unique_pending_invitations.sql` revokes older
duplicate pending invitations and adds a uniqueness guarantee for pending
`organization_id + email` invitations.

When deploying the web app on a different origin from the API, keep
`WEB_PUBLIC_URL` aligned with the externally reachable web URL used in magic
links, and keep `NEXT_PUBLIC_API_BASE_URL` aligned with the browser-reachable
API origin. For sibling `app.example.com` and `api.example.com` deployments,
set `AUTH_SESSION_COOKIE_DOMAIN=example.com` so the API can set one shared
HttpOnly session cookie. The browser confirmation and sign-out forms post
directly to API redirect endpoints, so the web app no longer mirrors API
`Set-Cookie` headers through Next.js.

Runtime API startup with `useInfrastructure: true` now registers auth routes
against Postgres automatically. Standard runtime startup now requires an
explicit provider-backed `AUTH_MAGIC_LINK_SENDER` value. At the moment,
`AUTH_MAGIC_LINK_SENDER=resend` also requires `AUTH_RESEND_API_KEY` and
`AUTH_RESEND_FROM_EMAIL`. Local fake delivery is available only through the
separate dev-only auth harness and is not part of the normal runtime path.
