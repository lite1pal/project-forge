import { describe, expect, it } from "vitest";
import Fastify from "fastify";

import { buildApp } from "../src/app.js";
import { registerEventRoutes } from "../src/modules/audit-events/routes.js";

describe("audit event routes", () => {
  it("accepts valid event payloads", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/events",
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

    await app.close();
  });

  it("lists recent event payloads", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: {
        event: "user.created",
        actor: "admin_123"
      }
    });
    await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: {
        event: "user.deleted",
        actor: "admin_123"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/events?limit=1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          event: "user.deleted",
          actor: "admin_123",
          metadata: {}
        }
      ]
    });

    await app.close();
  });

  it("rejects invalid list limits", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/events?limit=101"
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("rejects invalid event payloads", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/events",
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
      prefix: "/v1",
      service: {
        async ingest() {
          throw new Error("database unavailable");
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: {
        event: "user.deleted"
      }
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
      if (request.routeOptions.url === "/v1/events") {
        return reply.code(401).send({
          error: "missing_api_key"
        });
      }
    });

    await app.register(registerEventRoutes, {
      prefix: "/v1"
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/events",
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
});
