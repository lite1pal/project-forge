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

## Product Composition

The repo now has a manifest registry plus installed-product state for future
multi-product composition. Product modules are still registered in the current
application runtime, but organization context now carries which products are
enabled so the API and web layers can fail closed when a selected organization
does not have a given product installed. The public `GET /api` descriptor also
reports the centrally registered product list, while the web shell derives its
available product links from the same installed-product state.

## Request Correlation

The API accepts an optional request correlation header:

```text
x-request-id
```

If a valid `x-request-id` is supplied, the API reuses it. If it is missing or
invalid, the API generates a replacement request ID. The final value is always
returned in the response `x-request-id` header so callers can correlate API
responses with server-side request logs without changing response body shapes.

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

- generic internal error:

```json
{
  "error": "internal_server_error"
}
```

Unknown internal failures now follow an environment-aware policy. In
production, the API returns only the generic `internal_server_error` code and
does not expose stack traces, SQL errors, or raw exception messages. In local
development and test runs, the same response may include a debug `message`
field so failures remain diagnosable without changing the production contract.

## Authentication

Protected API routes use a bearer API key:

```text
Authorization: Bearer <dashboard_api_key>
```

Protected requests are accepted only for active API keys stored in the platform.
Local setup does not create a fixed development key. Create a project API key
from the dashboard or the API key management flow before calling protected
routes.

For `POST /api/v1/events`, rejected requests such as validation failures, auth
failures, quota failures, and rate-limit failures must not partially write an
audit event, increment monthly usage, or enqueue outbox jobs. The success path
must record the event and its durable outbox intent together.

The browser dashboard uses the signed-in session instead of a machine API key.
Its event reads are scoped by the selected organization and project through:

- `GET /api/v1/organizations/:organizationId/projects/:projectId/events`
- `GET /api/v1/organizations/:organizationId/projects/:projectId/events/stats`
- `GET /api/v1/organizations/:organizationId/projects/:projectId/events/timeseries`
- `GET /api/v1/organizations/:organizationId/projects/:projectId/webhooks`
- `GET /api/v1/organizations/:organizationId/billing`
- `GET /api/v1/organizations/:organizationId/members`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/webhooks`
- `PATCH /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId/rotate-secret`
- `DELETE /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId`
- `POST /api/v1/organizations/:organizationId/billing/checkout`
- `POST /api/v1/organizations/:organizationId/billing/portal`
- `POST /api/v1/organizations/:organizationId/plan`
- `POST /api/v1/organizations/:organizationId/onboarding-state`

## Session Workspace Routes

These browser-session routes use the signed-in user membership instead of a bearer API key:

- `GET /api/v1/organizations`
- `GET /api/v1/organizations/:organizationId/billing`
- `GET /api/v1/organizations/:organizationId/projects`
- `GET /api/v1/organizations/:organizationId/projects/:projectId/webhooks`
- `GET /api/v1/organizations/:organizationId/members`
- `POST /api/v1/organizations`
- `POST /api/v1/organizations/:organizationId/billing/checkout`
- `POST /api/v1/organizations/:organizationId/billing/portal`
- `POST /api/v1/organizations/:organizationId/projects`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/webhooks`
- `PATCH /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId/rotate-secret`
- `DELETE /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId`
- `POST /api/v1/organizations/:organizationId/invitations`
- `POST /api/v1/organizations/:organizationId/onboarding-state`
- `POST /api/v1/invitations/accept`
- `POST /api/v1/invitations/:invitationId/revoke`

The tenant-isolation rule behind these routes is stricter than the URL shape
alone: handlers, services, and repositories must all carry the resolved
`organizationId` through organization-owned and project-owned data access.
Repository methods for those resources should never rely on a bare project ID,
invitation ID, or similar opaque identifier as their only scope.

For audit-event reads specifically, the repository also verifies that the
requested project belongs to the requested organization before returning list,
stats, or timeseries data. A signed-in user who names another organization's
project route should receive `403 forbidden`, and a caller who is in the
organization but names a project that does not belong to that organization
should receive `404 project_not_found`, rather than an empty or leaky
cross-tenant response built from mismatched identifiers.

Product-scoped routes add one more fail-closed rule: when the organization does
not have the target product installed and enabled, the route should return
`404 product_not_installed` rather than falling back to another organization or
serving product data from a globally registered module.

## `GET /api/v1/me`

Returns the current signed-in user plus organization membership context used by
the hosted product shell.

Each membership now includes the installed-product set for that organization:

```json
{
  "memberships": [
    {
      "organizationId": "org-1",
      "organization": {
        "id": "org-1",
        "name": "Acme"
      },
      "role": "owner",
      "installedProducts": [
        {
          "productId": "audit-events",
          "enabled": true
        }
      ],
      "projectIds": ["project-1"],
      "projects": [
        {
          "id": "project-1",
          "name": "Production",
          "organizationId": "org-1"
        }
      ]
    }
  ],
  "user": {
    "id": "user-1",
    "email": "user@example.com"
  }
}
```

## Internal Support Lookup

The following routes are reserved for authenticated internal support or admin
users. They return safe summary data only and do not expose API keys, session
tokens, magic-link tokens, raw audit payloads, or billing-provider secrets:

- `GET /api/v1/support/organizations?query=...`
- `GET /api/v1/support/organizations/:organizationId`

Errors:

- `401 missing_session`
- `403 forbidden`
- `400 invalid_support_lookup_request`
- `404 organization_not_found`

Search requests require a non-empty query and are capped server-side. Detail
responses include only safe summary fields such as organization identity,
member counts, owner/admin email addresses when already non-secret, billing
summary state, and entitlement summary state.

## `GET /api/v1/organizations/:organizationId/members`

Lists the current organization members for signed-in users who belong to that organization.

Response:

```json
{
  "members": [
    {
      "id": "user-1",
      "email": "owner@example.com",
      "name": "Casey Owner",
      "role": "owner"
    }
  ]
}
```

Errors:

- `401 missing_session`
- `403 forbidden`

## `GET /api/v1/organizations/:organizationId/billing`

Returns the current persisted billing state for the organization plus the
current provider-configuration status.

Response:

```json
{
  "organizationId": "org-1",
  "providerConfigurationStatus": "configured",
  "customer": {
    "id": "customer-1",
    "provider": "stripe",
    "providerCustomerId": "cus_123",
    "createdAt": "2026-06-26T12:00:00.000Z",
    "updatedAt": "2026-06-26T12:00:00.000Z"
  },
  "subscription": {
    "id": "subscription-1",
    "billingCustomerId": "customer-1",
    "billingPlanId": "billing-growth-monthly",
    "entitlementPlanId": "growth",
    "provider": "stripe",
    "providerSubscriptionId": "sub_123",
    "providerPriceId": "price_123",
    "status": "active",
    "cancelAtPeriodEnd": false,
    "createdAt": "2026-06-26T12:00:00.000Z",
    "updatedAt": "2026-06-26T12:00:00.000Z"
  }
}
```

When no persisted billing state exists yet, `customer` and `subscription` are
`null`.

Errors:

- `401 missing_session`
- `403 forbidden`

## `POST /api/v1/organizations/:organizationId/billing/checkout`

Validates a checkout request shape for the organization and, when the provider
adapter is configured, returns a provider-neutral session link for the current
billing provider. The API remains generic: callers receive only a safe URL and
provider identifier, not provider SDK payloads.

Request:

```json
{
  "planId": "billing-growth-monthly",
  "successUrl": "https://app.example.com/settings/billing?success=1",
  "cancelUrl": "https://app.example.com/settings/billing"
}
```

Success response:

```json
{
  "provider": "stripe",
  "url": "https://checkout.stripe.com/c/pay/cs_test_123"
}
```

Configured billing still fails safely when no provider adapter or price mapping
is available:

```json
{
  "error": "billing_provider_not_configured"
}
```

Errors:

- `400 invalid_billing_request`
- `401 missing_session`
- `403 forbidden`
- `501 billing_provider_not_configured`

## Project Webhooks

Project owners and admins can manage outbound webhook endpoints through:

- `GET /api/v1/organizations/:organizationId/projects/:projectId/webhooks`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/webhooks`
- `PATCH /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId/rotate-secret`
- `DELETE /api/v1/organizations/:organizationId/projects/:projectId/webhooks/:endpointId`

Create requests accept:

```json
{
  "url": "https://example.com/auditrail/webhooks",
  "subscribedEventTypes": ["audit.event.created"]
}
```

Create and rotate-secret responses reveal the current endpoint secret once:

```json
{
  "endpoint": {
    "id": "endpoint-1",
    "organizationId": "org-1",
    "projectId": "project-1",
    "url": "https://example.com/auditrail/webhooks",
    "enabled": true,
    "subscribedEventTypes": ["audit.event.created"],
    "latestDelivery": null,
    "createdAt": "2026-06-30T10:00:00.000Z",
    "updatedAt": "2026-06-30T10:00:00.000Z"
  },
  "secret": "whsec_..."
}
```

The list response includes the latest delivery summary per endpoint.

Stable errors:

- `400 invalid_webhook_request`
- `401 missing_session`
- `403 forbidden`
- `404 project_not_found`
- `404 webhook_not_found`

## Outbound Webhook Signing

Successful `POST /api/v1/events` ingest now fans out asynchronously to enabled
project webhook endpoints that subscribe to `audit.event.created`.

Headers:

- `x-project-anvil-webhook-event`
- `x-project-anvil-webhook-product`
- `x-project-anvil-webhook-timestamp`
- `x-project-anvil-webhook-signature`

Signature input:

```text
<timestamp>.<raw-json-body>
```

Signature value:

- lowercase hex `HMAC-SHA256` of the input string using the endpoint secret

Payload shape:

```json
{
  "id": "event-1",
  "type": "audit.event.created",
  "productId": "audit-events",
  "organizationId": "org-1",
  "projectId": "project-1",
  "createdAt": "2026-06-30T10:00:00.000Z",
  "data": {
    "auditEvent": {
      "id": "event-1",
      "eventType": "invoice.sent",
      "actorId": "user-1",
      "targetId": "invoice-42",
      "metadata": {
        "source": "billing-job"
      },
      "createdAt": "2026-06-30T10:00:00.000Z"
    }
  }
}
```

The current v1 webhook payload product is `audit-events`. Consumers should use
the payload field and matching header to route framework-level integrations
without inferring ownership from the event type alone.

## `POST /api/v1/organizations/:organizationId/billing/portal`

Validates a billing-portal request shape for the organization and, when the
provider adapter is configured and the organization already has a persisted
billing customer, returns a provider-neutral session link for the current
billing provider.

Request:

```json
{
  "returnUrl": "https://app.example.com/settings/billing"
}
```

Success response:

```json
{
  "provider": "stripe",
  "url": "https://billing.stripe.com/session/test_123"
}
```

If the organization has no persisted billing customer yet:

```json
{
  "error": "billing_customer_not_found"
}
```

Configured billing still fails safely when the provider adapter is unavailable:

```json
{
  "error": "billing_provider_not_configured"
}
```

Errors:

- `400 invalid_billing_request`
- `401 missing_session`
- `403 forbidden`
- `409 billing_customer_not_found`
- `501 billing_provider_not_configured`

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

Returns supported API version metadata plus the centrally registered product
catalog exposed by the current runtime.

Response:

```json
{
  "basePath": "/api",
  "latestVersion": "v1",
  "defaultVersion": "v1",
  "products": [
    {
      "id": "audit-events",
      "name": "AuditTrail"
    }
  ],
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
- `402 event_quota_exceeded`
- `429 Too Many Requests`

Response schema is explicit in the OpenAPI document.

Quota-exceeded response:

```json
{
  "error": "event_quota_exceeded",
  "plan": {
    "id": "starter",
    "name": "Starter",
    "includedEvents": 100000,
    "usedEvents": 100000,
    "remainingEvents": 0,
    "periodStart": "2026-06-01T00:00:00.000Z",
    "periodEnd": "2026-07-01T00:00:00.000Z"
  }
}
```

Included events reset on UTC calendar month boundaries. Quota enforcement
applies only to `POST /api/v1/events`; dashboard and session-scoped reads remain
available while an organization is over quota.

## `GET /api/v1/me`

Returns the signed-in browser user and their workspace memberships.

Each membership now includes pricing and onboarding summaries for the organization:

The `user` object returned by this route remains limited to the public session
identity fields and does not expose internal support-role state.

```json
{
  "user": {
    "id": "user-1",
    "email": "owner@example.com"
  },
  "memberships": [
    {
      "organizationId": "org-1",
      "role": "owner",
      "onboarding": {
        "isComplete": false,
        "isDismissed": false,
        "completedRequiredSteps": 1,
        "totalRequiredSteps": 3,
        "steps": [
          {
            "id": "project_created",
            "required": true,
            "status": "complete",
            "completedAt": "2026-06-25T12:00:00.000Z"
          },
          {
            "id": "api_key_created",
            "required": true,
            "status": "pending"
          },
          {
            "id": "first_event_ingested",
            "required": true,
            "status": "pending"
          },
          {
            "id": "member_invited",
            "required": false,
            "status": "pending"
          }
        ]
      },
      "plan": {
        "id": "starter",
        "name": "Starter",
        "includedEvents": 100000,
        "usedEvents": 42,
        "remainingEvents": 99958,
        "periodStart": "2026-06-01T00:00:00.000Z",
        "periodEnd": "2026-07-01T00:00:00.000Z"
      },
      "organization": {
        "id": "org-1",
        "name": "Acme"
      },
      "projectIds": ["project-1"],
      "projects": [
        {
          "id": "project-1",
          "organizationId": "org-1",
          "name": "Production"
        }
      ]
    }
  ]
}
```

Onboarding uses derived organization milestones:

- `project_created`: first project exists
- `api_key_created`: any API key has been created for any project in the organization
- `first_event_ingested`: any audit event exists for the organization
- `member_invited`: any invitation exists for the organization

Required steps are `project_created`, `api_key_created`, and
`first_event_ingested`. `member_invited` is optional. Dismissal state is
per-user per-organization and does not change completion.

## `POST /api/v1/organizations/:organizationId/onboarding-state`

Stores the signed-in member's onboarding sidebar dismissal state for one organization.

Request:

```json
{
  "dismissed": true
}
```

Response:

```json
{
  "onboardingState": {
    "organizationId": "org-1",
    "userId": "user-1",
    "dismissedAt": "2026-06-25T12:05:00.000Z"
  }
}
```

Errors:

- `401 missing_session`
- `403 forbidden`

## `POST /api/v1/organizations/:organizationId/plan`

Changes the selected pricing plan for an organization.

Allowed roles:

- `owner`
- `admin`

Request:

```json
{
  "planId": "growth"
}
```

Response:

```json
{
  "organizationId": "org-1",
  "planId": "growth"
}
```

Errors:

- `400 invalid_plan_change_request`
- `401 missing_session`
- `403 forbidden`

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

Auth v1 uses custom email magic links and HttpOnly session cookies. Machine API
keys remain for event ingestion and server-to-server access.

The auth route adapter is implemented as a feature-owned Fastify plugin with
tests and injectable services. Production registration still requires persistent
auth repositories, email delivery configuration, and explicit session-cookie
environment parsing.

The app builder can register auth routes when an `AuthService` is injected.
Runtime registration with Postgres persistence and email delivery is the next
step after configuring the auth environment.

When `buildApp({ useInfrastructure: true })` is used in the standard API server,
the API registers auth routes with the Postgres auth repository, platform
context repository, and a provider-backed runtime magic-link sender. Standard
runtime startup requires an explicit auth sender selection and currently accepts
`AUTH_MAGIC_LINK_SENDER=resend` only.

Local manual sign-in without a delivery provider is available only through the
separate local-auth dev harness entrypoint, not through the standard API
runtime.

`GET /api/v1/me` returns the authenticated browser user and their organization
membership context, including organization and project summaries. API-key
ingestion authentication remains separate from browser session authentication.

The first platform management routes cover organization listing/creation and
project listing/creation under an organization. They require browser session
auth and enforce membership roles in the platform service.

Invitation routes support creating organization invitations, accepting an
invitation token for the current user, and revoking pending invitations. Tokens
are opaque and only token hashes are persisted.
Accepting another valid invitation for an organization the user already belongs
to returns the existing membership instead of creating a duplicate membership.
Pending invitations are unique per organization/email. A signed-in user can only
accept an invitation addressed to their own email.

Runtime API infrastructure mode registers the platform routes with
cookie-backed session resolution. Web settings screens consume:

- `GET /api/v1/organizations`
- `POST /api/v1/organizations`
- `GET /api/v1/organizations/:organizationId/projects`
- `POST /api/v1/organizations/:organizationId/projects`
- `GET /api/v1/organizations/:organizationId/projects/:projectId/api-keys`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/api-keys`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/api-keys/:apiKeyId/revoke`
- `POST /api/v1/organizations/:organizationId/invitations`
- `POST /api/v1/invitations/accept`

## `GET /api/v1/organizations/:organizationId/projects/:projectId/api-keys`

Lists project API keys for the authenticated browser-session user.

Response:

```json
{
  "apiKeys": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "keyPrefix": "atlabcd123",
      "name": "Production ingest",
      "revoked": false,
      "createdAt": "2026-06-18T10:00:00.000Z"
    }
  ]
}
```

Raw API key values are never returned from list endpoints.

## `POST /api/v1/organizations/:organizationId/projects/:projectId/api-keys`

Creates a new API key for the selected project.

Request:

```json
{
  "name": "Production ingest"
}
```

Response:

```json
{
  "apiKey": {
    "id": "uuid",
    "projectId": "uuid",
    "keyPrefix": "atlabcd123",
    "name": "Production ingest",
    "revoked": false,
    "createdAt": "2026-06-18T10:00:00.000Z"
  },
  "rawKey": "atlabcd123_secret"
}
```

The full `rawKey` is returned only on create.

## `POST /api/v1/organizations/:organizationId/projects/:projectId/api-keys/:apiKeyId/revoke`

Revokes an existing project API key.

Response:

```text
204 No Content
```

## Generated Resource Proof Routes

The committed generated-resource proof slice currently installs one
organization-owned resource:

- `GET /api/v1/organizations/:organizationId/customers`
- `POST /api/v1/organizations/:organizationId/customers`
- `GET /api/v1/organizations/:organizationId/customers/:id`
- `PATCH /api/v1/organizations/:organizationId/customers/:id`

Current contract:

- session auth is required on every route
- reads return `403 forbidden` unless the session user is an
  `owner`, `admin`, `member`, or `viewer` of the organization
- writes return `403 forbidden` unless the session user is an
  `owner`, `admin`, or `member` of the organization
- `GET /customers` returns `{ "items": CustomerRecord[] }`
- `POST`, `GET /:id`, and `PATCH /:id` return one `CustomerRecord`
- `GET /:id` and `PATCH /:id` return `404 not_found` when the record is absent

## Web Auth Consumption

`apps/web` consumes these browser auth endpoints directly through the shared API
client. It does not define Next.js route handlers, proxy endpoints, or `pages/api`
routes.

The magic-link callback flow posts the email and token to
`POST /api/v1/auth/sessions/confirm`, which sets the shared session cookie on
the API response and redirects the browser back to the web app. Sign-out uses
`POST /api/v1/auth/sessions/current/logout` the same way. Protected web screens
then forward the incoming browser cookie to `GET /api/v1/me` so the API remains
the only session authority. Both redirect endpoints accept normal browser
`application/x-www-form-urlencoded` form submissions.
