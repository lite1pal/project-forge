# API

Base URL for local development:

```text
http://localhost:4000
```

API descriptor:

```text
GET /api
```

OpenAPI document:

```text
GET /api/v1/openapi.json
```

Canonical versioned base path:

```text
/api/v1
```

Operational health remains unversioned at `/health` for load balancers and container health checks.
The versioned route `/api/v1/health` is available for API consumers that want a versioned health path.

## Versioning Rules

- `/api/v1` is the only supported contract path
- breaking changes require a new version path such as `/api/v2`
- additive, backward-compatible fields may be introduced within `v1`
- deprecated fields or endpoints must be documented before removal
- infrastructure health checks remain outside API versioning at `/health`

## Shared Error Shapes

Most protected routes use one of these shared response shapes:

- simple auth/domain error:

```json
{
  "error": "missing_api_key"
}
```

- validation error:

```json
{
  "error": "invalid_event_query",
  "issues": [
    {
      "path": ["from"],
      "message": "Invalid input",
      "code": "format"
    }
  ]
}
```

- rate-limit error:

```json
{
  "statusCode": 429,
  "code": "FST_ERR_RATE_LIMIT",
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 1 minute"
}
```

## Authentication

Protected API routes use a bearer API key:

```text
Authorization: Bearer atl_local_dev_key
```

The seed script creates `atl_local_dev_key` for local development.

## Rate Limiting

Rate limiting is enabled by default for API routes.

Environment:

- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW`

`/health` is exempt so health checks do not consume API quota.

## `GET /health`

Returns API health.

Response:

```json
{
  "status": "ok"
}
```

## `GET /api`

Returns supported API version metadata.

Response:

```json
{
  "basePath": "/api",
  "latestVersion": "v1",
  "defaultVersion": "v1",
  "versions": [
    {
      "version": "v1",
      "path": "/api/v1"
    }
  ]
}
```

## `GET /api/v1/openapi.json`

Returns the OpenAPI 3 document for the current API version.

## `POST /api/v1/events`

Ingests an audit event.

Request:

```json
{
  "event": "user.deleted",
  "actor": "admin_123",
  "target": "user_456",
  "metadata": {
    "reason": "GDPR request"
  }
}
```

Response:

```json
{
  "id": "uuid",
  "event": "user.deleted",
  "accepted": true
}
```

Errors:

- `400 invalid_event_payload`
- `401 missing_api_key`
- `401 invalid_api_key`
- `429 Too Many Requests`

Response schema is explicit in the OpenAPI document.

## `GET /api/v1/events`

Lists recent audit events for the authenticated project.

Query:

- `limit`: optional integer from `1` to `100`, default `25`
- `cursor`: optional opaque cursor returned by a previous response
- `event`: optional exact event type
- `actor`: optional exact actor id
- `target`: optional exact target id
- `events`: optional comma-separated exact event types
- `actors`: optional comma-separated exact actor ids
- `targets`: optional comma-separated exact target ids
- `from`: optional inclusive ISO datetime lower bound
- `to`: optional inclusive ISO datetime upper bound

Single-value and multi-value filters can be combined. Internally they are merged into one exact-match filter set.

Response:

```json
{
  "events": [
    {
      "id": "uuid",
      "event": "user.deleted",
      "actor": "admin_123",
      "target": "user_456",
      "createdAt": "2026-06-16T12:05:00.000Z",
      "metadata": {
        "reason": "GDPR request"
      }
    }
  ],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "opaque-cursor"
  }
}
```

Errors:

- `400 invalid_event_query`
- `401 missing_api_key`
- `401 invalid_api_key`
- `429 Too Many Requests`

Results are sorted by `createdAt DESC`.

When `hasMore` is `true`, pass `pageInfo.nextCursor` back as `cursor` to fetch the next page.

Cursor ordering is stable on:

- `createdAt DESC`
- `id DESC` as a tie-breaker

## `GET /api/v1/events/stats`

Returns a small dashboard-oriented summary for the authenticated project.

Query:

- `top`: optional integer from `1` to `20`, default `5`
- `from`: optional inclusive ISO datetime lower bound
- `to`: optional inclusive ISO datetime upper bound

Response:

```json
{
  "totalEvents": 4,
  "topEventTypes": [
    {
      "event": "user.deleted",
      "count": 2
    },
    {
      "event": "role.changed",
      "count": 1
    }
  ]
}
```

Errors:

- `400 invalid_event_query`
- `401 missing_api_key`
- `401 invalid_api_key`
- `429 Too Many Requests`

## `GET /api/v1/events/timeseries`

Returns time-bucketed event counts for the authenticated project.

Query:

- `from`: required inclusive ISO datetime lower bound
- `to`: required inclusive ISO datetime upper bound
- `bucket`: required `hour` or `day`

Response:

```json
{
  "points": [
    {
      "bucketStart": "2026-06-16T12:00:00.000Z",
      "count": 2
    }
  ]
}
```

Errors:

- `400 invalid_event_query`
- `401 missing_api_key`
- `401 invalid_api_key`
- `429 Too Many Requests`
## Planned Platform API

The production platform API will remain under `/api/v1` and must be implemented
in `apps/api`; `apps/web` must not add route handlers or proxy endpoints.

Planned route groups:

- auth: magic-link request, session creation, current session logout
- identity: current user and active membership context
- organizations: organization, project, membership, and invitation management
- exports: async audit-event export job creation, listing, status, and signed download

Auth v1 uses custom email magic links and HttpOnly session cookies. Machine API
keys remain for event ingestion and server-to-server access.

The auth route adapter is implemented as a feature-owned Fastify plugin with
tests and injectable services. Production registration still requires persistent
auth repositories, email delivery configuration, and explicit session-cookie
environment parsing.

The app builder can register auth routes when an `AuthService` is injected.
Runtime registration with Postgres persistence and email delivery is the next
step after configuring the auth environment.

`GET /api/v1/me` returns the authenticated browser user and their organization
membership context, including organization and project summaries. API-key
ingestion authentication remains separate from browser session authentication.

The first platform management routes cover organization listing/creation and
project listing/creation under an organization. They require browser session
auth and enforce membership roles in the platform service.

Invitation routes support creating organization invitations, accepting an
invitation token for the current user, and revoking pending invitations. Tokens
are opaque and only token hashes are persisted.

Export routes support creating async audit-event export jobs, listing project
exports, checking export status, and returning signed download URLs for
completed jobs.
