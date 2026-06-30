import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerPlatformProjectWebhookRoutes } from "../routes.js";
import type { PlatformProjectWebhooksService } from "../service.js";

describe("registerPlatformProjectWebhookRoutes", () => {
  it("lists project webhooks for authorized admins", async () => {
    const app = buildTestApp({
      async listEndpointsForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          projectId: "project-1",
          userId: "user-1"
        });

        return [
          {
            createdAt: "2026-06-30T10:00:00.000Z",
            enabled: true,
            id: "endpoint-1",
            latestDelivery: null,
            organizationId: "org-1",
            projectId: "project-1",
            subscribedEventTypes: ["audit.event.created"],
            updatedAt: "2026-06-30T10:00:00.000Z",
            url: "https://example.com/webhooks/auditrail"
          }
        ];
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects/project-1/webhooks"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      endpoints: [
        {
          createdAt: "2026-06-30T10:00:00.000Z",
          enabled: true,
          id: "endpoint-1",
          latestDelivery: null,
          organizationId: "org-1",
          projectId: "project-1",
          subscribedEventTypes: ["audit.event.created"],
          updatedAt: "2026-06-30T10:00:00.000Z",
          url: "https://example.com/webhooks/auditrail"
        }
      ]
    });
  });

  it("creates a project webhook and reveals its secret once", async () => {
    const app = buildTestApp({
      async createEndpointForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          projectId: "project-1",
          subscribedEventTypes: ["audit.event.created"],
          url: "https://example.com/webhooks/auditrail",
          userId: "user-1"
        });

        return {
          endpoint: {
            createdAt: "2026-06-30T10:00:00.000Z",
            enabled: true,
            id: "endpoint-1",
            organizationId: "org-1",
            projectId: "project-1",
            subscribedEventTypes: ["audit.event.created"],
            updatedAt: "2026-06-30T10:00:00.000Z",
            url: "https://example.com/webhooks/auditrail"
          },
          secret: "whsec_test_123"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        subscribedEventTypes: ["audit.event.created"],
        url: "https://example.com/webhooks/auditrail"
      },
      url: "/organizations/org-1/projects/project-1/webhooks"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      endpoint: {
        createdAt: "2026-06-30T10:00:00.000Z",
        enabled: true,
        id: "endpoint-1",
        latestDelivery: null,
        organizationId: "org-1",
        projectId: "project-1",
        subscribedEventTypes: ["audit.event.created"],
        updatedAt: "2026-06-30T10:00:00.000Z",
        url: "https://example.com/webhooks/auditrail"
      },
      secret: "whsec_test_123"
    });
  });

  it("maps forbidden and missing-session failures to stable errors", async () => {
    const app = buildTestApp(
      {
        async listEndpointsForUser() {
          throw new Error("forbidden");
        }
      },
      { session: false }
    );

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects/project-1/webhooks"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toEqual({ error: "missing_session" });

    const authedApp = buildTestApp({
      async listEndpointsForUser() {
        throw new Error("forbidden");
      }
    });
    const forbidden = await authedApp.inject({
      method: "GET",
      url: "/organizations/org-1/projects/project-1/webhooks"
    });

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "forbidden" });
  });

  it("rejects invalid webhook request bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {
        subscribedEventTypes: [],
        url: "notaurl"
      },
      url: "/organizations/org-1/projects/project-1/webhooks"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_webhook_request" });
  });
});

function buildTestApp(
  overrides: Partial<PlatformProjectWebhooksService>,
  options: { session?: boolean } = {}
) {
  const app = Fastify();
  app.decorateRequest("sessionUser");
  app.addHook("preHandler", async (request) => {
    if (options.session === false) {
      request.sessionUser = undefined;
      return;
    }

    request.sessionUser = {
      email: "user@example.com",
      id: "user-1"
    };
  });
  app.register(registerPlatformProjectWebhookRoutes, {
    service: {
      async createEndpointForUser() {
        throw new Error("not_implemented");
      },
      async deleteEndpointForUser() {
        throw new Error("not_implemented");
      },
      async listEndpointsForUser() {
        return [];
      },
      async rotateSecretForUser() {
        throw new Error("not_implemented");
      },
      async updateEndpointForUser() {
        throw new Error("not_implemented");
      },
      ...overrides
    }
  });

  return app;
}
