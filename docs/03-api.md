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

Response:

```json
{
  "events": [
    {
      "id": "uuid",
      "event": "user.deleted",
      "actor": "admin_123",
      "target": "user_456",
      "metadata": {
        "reason": "GDPR request"
      }
    }
  ]
}
```

Errors:

- `400 invalid_event_query`
- `401 missing_api_key`
- `401 invalid_api_key`
- `429 Too Many Requests`

