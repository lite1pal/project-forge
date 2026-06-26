import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { API_VERSION_PREFIX } from "../../../api-version.js";
import { buildApp } from "../../../app.js";
import { decodeAuditEventCursor } from "../cursor.js";
import { createInMemoryAuditEventRepo } from "../repo.js";
import { registerEventRoutes } from "../routes.js";
import { createAuditEventService } from "../service.js";

describe("audit event routes", () => {
  it("accepts valid event payloads", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        actor: "admin_123",
        target: "user_456",
        metadata: {
          reason: "GDPR request"
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      event: "user.deleted",
      accepted: true
    });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));

    await app.close();
  });

  it("enqueues an audit-event.created job with the ingested identifiers", async () => {
    const enqueuedJobs: Array<{
      name: string;
      payload: unknown;
    }> = [];
    const app = await buildEventRouteTestApp(["2026-06-16T12:00:00.000Z"], {
      enqueueJob(job) {
        enqueuedJobs.push(job);
      }
    });

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        metadata: {}
      }
    });

    expect(response.statusCode).toBe(202);
    expect(enqueuedJobs).toEqual([
      {
        name: "audit-event.created",
        payload: {
          createdAt: "2026-06-16T12:00:00.000Z",
          eventId: response.json().id,
          organizationId: "00000000-0000-0000-0000-000000000000",
          projectId: "00000000-0000-0000-0000-000000000000"
        }
      }
    ]);

    await app.close();
  });

  it("returns 402 when the organization quota is exhausted", async () => {
    const organizationId = "00000000-0000-0000-0000-000000000000";
    const enqueueJob = vi.fn();
    const app = await buildEventRouteTestApp(["2026-06-16T12:00:00.000Z"], {
      enqueueJob,
      planByOrganizationId: {
        [organizationId]: "starter"
      },
      usageByKey: {
        [`${organizationId}:2026-06-01T00:00:00.000Z`]: 100_000
      }
    });

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });

    expect(response.statusCode).toBe(402);
    expect(enqueueJob).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: "event_quota_exceeded",
      plan: {
        id: "starter",
        includedEvents: 100000,
        name: "Starter",
        periodEnd: "2026-07-01T00:00:00.000Z",
        periodStart: "2026-06-01T00:00:00.000Z",
        remainingEvents: 0,
        usedEvents: 100000
      }
    });

    await app.close();
  });

  it("returns 500 and does not persist the event when enqueue fails", async () => {
    const app = await buildEventRouteTestApp(["2026-06-16T12:00:00.000Z"], {
      enqueueJob() {
        throw new Error("enqueue_failed");
      }
    });

    const ingestResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        metadata: {}
      }
    });
    const listResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events`
    });

    expect(ingestResponse.statusCode).toBe(500);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      events: [],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    await app.close();
  });

  it("rejects invalid event payloads before enqueueing", async () => {
    const enqueueJob = vi.fn();
    const app = await buildEventRouteTestApp(["2026-06-16T12:00:00.000Z"], {
      enqueueJob
    });

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        metadata: {}
      }
    });

    expect(response.statusCode).toBe(400);
    expect(enqueueJob).not.toHaveBeenCalled();

    await app.close();
  });

  it("lists recent event payloads", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:05:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created",
        actor: "admin_123"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        actor: "admin_123"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?limit=1`
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      events: [
        {
          event: "user.deleted",
          actor: "admin_123",
          metadata: {},
          createdAt: "2026-06-16T12:05:00.000Z"
        }
      ],
      pageInfo: {
        hasMore: true
      }
    });
    expect(body.pageInfo.nextCursor).toEqual(expect.any(String));

    await app.close();
  });

  it("rejects invalid list limits", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?limit=101`
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_event_query"
    });

    await app.close();
  });

  it("filters events by event type", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:01:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created",
        actor: "admin_123"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        actor: "admin_123"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?event=user.deleted`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "user.deleted"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    await app.close();
  });

  it("filters events by actor", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:01:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created",
        actor: "admin_123"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        actor: "service_456"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?actor=admin_123`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "user.created",
          actor: "admin_123"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    await app.close();
  });

  it("filters events by target", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:01:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created",
        target: "user_123"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        target: "user_456"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?target=user_456`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "user.deleted",
          target: "user_456"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    await app.close();
  });

  it("filters events by from and to dates", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:05:00.000Z",
      "2026-06-16T12:10:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?from=2026-06-16T12:04:00.000Z&to=2026-06-16T12:06:00.000Z`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "user.deleted",
          createdAt: "2026-06-16T12:05:00.000Z"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    await app.close();
  });

  it("supports cursor pagination", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:05:00.000Z",
      "2026-06-16T12:10:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed"
      }
    });

    const firstPage = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?limit=2`
    });
    const firstPageBody = firstPage.json();

    expect(firstPage.statusCode).toBe(200);
    expect(firstPageBody).toMatchObject({
      events: [
        {
          event: "role.changed"
        },
        {
          event: "user.deleted"
        }
      ],
      pageInfo: {
        hasMore: true
      }
    });
    expect(firstPageBody.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(decodeAuditEventCursor(firstPageBody.pageInfo.nextCursor)).toMatchObject({
      createdAt: "2026-06-16T12:05:00.000Z"
    });

    const secondPage = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?limit=2&cursor=${firstPageBody.pageInfo.nextCursor}`
    });

    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json()).toMatchObject({
      events: [
        {
          event: "user.created"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    await app.close();
  });

  it("supports comma-separated multi-value filters", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:01:00.000Z",
      "2026-06-16T12:02:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created",
        actor: "admin_123",
        target: "user_123"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        actor: "service_456",
        target: "user_456"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed",
        actor: "admin_123",
        target: "role_789"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?events=user.deleted,role.changed&actors=admin_123,service_456&targets=user_456,role_789`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "role.changed",
          actor: "admin_123",
          target: "role_789"
        },
        {
          event: "user.deleted",
          actor: "service_456",
          target: "user_456"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    await app.close();
  });

  it("merges single-value and multi-value filters without duplicates", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:01:00.000Z",
      "2026-06-16T12:02:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted",
        actor: "admin_123"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed",
        actor: "service_456"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "invoice.refunded",
        actor: "admin_123"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?event=user.deleted&events=user.deleted,role.changed&actors=admin_123,service_456`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "role.changed"
        },
        {
          event: "user.deleted"
        }
      ]
    });

    await app.close();
  });

  it("rejects invalid date params", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?from=not-a-date`
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_event_query"
    });

    await app.close();
  });

  it("rejects invalid stats query params", async () => {
    const app = await buildEventRouteTestApp([]);

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/stats?from=2026-06-16T13:00:00.000Z&to=2026-06-16T12:00:00.000Z`
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_event_query"
    });

    await app.close();
  });

  it("rejects invalid timeseries query params", async () => {
    const app = await buildEventRouteTestApp([]);

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/timeseries?from=2026-06-16T13:00:00.000Z&to=2026-06-16T12:00:00.000Z&bucket=hour`
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_event_query"
    });

    await app.close();
  });

  it("rejects invalid cursors", async () => {
    const app = await buildEventRouteTestApp([]);

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?cursor=not-a-valid-cursor`
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_event_query"
    });

    await app.close();
  });

  it("rejects invalid event payloads", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: ""
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_event_payload"
    });

    await app.close();
  });

  it("lets unexpected ingestion errors use Fastify error handling", async () => {
    const app = Fastify({
      logger: false
    });

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX,
      service: {
        async ingest() {
          throw new Error("database unavailable");
        },
        async list() {
          return [];
        },
        async summarize() {
          return {
            totalEvents: 0,
            topEventTypes: []
          };
        },
        async timeseries() {
          return [];
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });

  it("lets unexpected list errors use Fastify error handling", async () => {
    const app = Fastify({
      logger: false
    });

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX,
      service: {
        async ingest() {
          throw new Error("not used");
        },
        async list() {
          throw new Error("list unavailable");
        },
        async summarize() {
          return {
            totalEvents: 0,
            topEventTypes: []
          };
        },
        async timeseries() {
          return [];
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events`
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });

  it("lets unexpected summary errors use Fastify error handling", async () => {
    const app = Fastify({
      logger: false
    });

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX,
      service: {
        async ingest() {
          throw new Error("not used");
        },
        async list() {
          return [];
        },
        async summarize() {
          throw new Error("summary unavailable");
        },
        async timeseries() {
          return [];
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/stats?top=5`
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });

  it("lets unexpected timeseries errors use Fastify error handling", async () => {
    const app = Fastify({
      logger: false
    });

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX,
      service: {
        async ingest() {
          throw new Error("not used");
        },
        async list() {
          return [];
        },
        async summarize() {
          return {
            totalEvents: 0,
            topEventTypes: []
          };
        },
        async timeseries() {
          throw new Error("timeseries unavailable");
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/timeseries?from=2026-06-16T12:00:00.000Z&to=2026-06-16T13:00:00.000Z&bucket=hour`
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });

  it("rejects requests without an API key when auth is registered", async () => {
    const app = Fastify({
      logger: false
    });

    app.decorateRequest("apiKeyPrincipal");
    app.addHook("preHandler", async (request, reply) => {
      if (request.routeOptions.url === `${API_VERSION_PREFIX}/events`) {
        return reply.code(401).send({
          error: "missing_api_key"
        });
      }
    });

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX
    });

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "missing_api_key"
    });

    await app.close();
  });

  it("lists project events through the session-authenticated dashboard route", async () => {
    const list = vi.fn(async () => [
      {
        id: "event-1",
        eventType: "billing.tested",
        actorId: "setup-script",
        targetId: "first-event",
        metadata: {
          source: "mvp-onboarding"
        },
        createdAt: "2026-06-18T10:00:00.000Z"
      }
    ]);
    const app = Fastify({
      logger: false
    });

    app.decorateRequest("sessionUser");
    app.addHook("preHandler", async (request) => {
      request.sessionUser = {
        email: "user@example.com",
        id: "user-1"
      };
    });

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX,
      projectAccess: {
        async resolveTenantForUser(input: {
          organizationId: string;
          projectId: string;
          userId: string;
        }) {
          expect(input).toEqual({
            organizationId: "org-1",
            projectId: "project-2",
            userId: "user-1"
          });

          return {
            organizationId: input.organizationId,
            projectId: input.projectId
          };
        }
      },
      service: {
        async ingest() {
          throw new Error("not used");
        },
        list,
        async summarize() {
          return {
            totalEvents: 0,
            topEventTypes: []
          };
        },
        async timeseries() {
          return [];
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/org-1/projects/project-2/events?limit=25`
    });

    expect(response.statusCode).toBe(200);
    expect(list).toHaveBeenCalledWith(
      {
        organizationId: "org-1",
        projectId: "project-2"
      },
      expect.objectContaining({
        limit: 26
      })
    );
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "billing.tested",
          actor: "setup-script",
          target: "first-event"
        }
      ]
    });

    await app.close();
  });

  it("requires a session for project dashboard event routes", async () => {
    const app = Fastify({
      logger: false
    });

    app.decorateRequest("sessionUser");

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX,
      projectAccess: {
        async resolveTenantForUser() {
          throw new Error("not used");
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/org-1/projects/project-2/events`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "missing_session"
    });

    await app.close();
  });

  it("maps missing projects on project dashboard event routes to 404", async () => {
    const app = Fastify({
      logger: false
    });

    app.decorateRequest("sessionUser");
    app.addHook("preHandler", async (request) => {
      request.sessionUser = {
        email: "user@example.com",
        id: "user-1"
      };
    });

    await app.register(registerEventRoutes, {
      prefix: API_VERSION_PREFIX,
      projectAccess: {
        async resolveTenantForUser() {
          throw new Error("project_not_found");
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/org-1/projects/project-2/events`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "project_not_found"
    });

    await app.close();
  });

  it("returns project event summary stats", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:01:00.000Z",
      "2026-06-16T12:02:00.000Z",
      "2026-06-16T12:03:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/stats?top=2`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      totalEvents: 4,
      topEventTypes: [
        {
          event: "user.deleted",
          count: 2
        },
        {
          event: "role.changed",
          count: 1
        }
      ]
    });

    await app.close();
  });

  it("filters event summary stats by date range", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:05:00.000Z",
      "2026-06-16T12:10:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/stats?from=2026-06-16T12:04:00.000Z&to=2026-06-16T12:06:00.000Z`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      totalEvents: 1,
      topEventTypes: [
        {
          event: "user.deleted",
          count: 1
        }
      ]
    });

    await app.close();
  });

  it("returns event timeseries", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:05:00.000Z",
      "2026-06-16T12:35:00.000Z",
      "2026-06-17T00:10:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/timeseries?from=2026-06-16T00:00:00.000Z&to=2026-06-18T00:00:00.000Z&bucket=hour`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      points: [
        {
          bucketStart: "2026-06-16T12:00:00.000Z",
          count: 2
        },
        {
          bucketStart: "2026-06-17T00:00:00.000Z",
          count: 1
        }
      ]
    });

    await app.close();
  });

  it("uses a stable id tie-breaker when timestamps match", async () => {
    const app = await buildEventRouteTestApp([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:00:00.000Z"
    ]);

    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.created"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "user.deleted"
      }
    });
    await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      payload: {
        event: "role.changed"
      }
    });

    const firstPage = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?limit=2`
    });
    const firstPageBody = firstPage.json();
    const secondPage = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?limit=2&cursor=${firstPageBody.pageInfo.nextCursor}`
    });

    expect(firstPage.statusCode).toBe(200);
    expect(secondPage.statusCode).toBe(200);
    expect(firstPageBody.events).toHaveLength(2);
    expect(secondPage.json().events).toHaveLength(1);

    await app.close();
  });
});

async function buildEventRouteTestApp(
  createdAtValues: string[],
  repoOptions: Parameters<typeof createInMemoryAuditEventRepo>[0] = {}
) {
  let index = 0;
  const repo = createInMemoryAuditEventRepo({
    ...repoOptions,
    now: () => createdAtValues[index++] ?? "2026-06-16T12:59:59.000Z"
  });
  const service = createAuditEventService(repo);
  const app = Fastify({
    logger: false
  });

  await app.register(registerEventRoutes, {
    prefix: API_VERSION_PREFIX,
    service
  });

  return app;
}
