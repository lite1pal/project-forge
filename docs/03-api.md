# API

Base URL for local development:

```text
http://localhost:4000
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

## `POST /v1/events`

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

## `GET /v1/events`

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

## `GET /v1/events/stats`

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

## `GET /v1/events/timeseries`

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
