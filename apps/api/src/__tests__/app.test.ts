import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { API_BASE_PATH, API_VERSION_PREFIX } from "../api-version.js";
import { buildApp, requireRuntimeConfig } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthService } from "../modules/auth/service.js";
import type { PlatformService } from "../modules/platform/service.js";
import type { ApiKeyService } from "../modules/api-keys/service.js";

describe("health route", () => {
  it("can register infrastructure plugins for runtime mode", async () => {
    const app = buildApp({
      useInfrastructure: true
    });

    expect(app).toBeDefined();

    await app.close();
  });

  it("can register infrastructure plugins with explicit overrides", async () => {
    const app = buildApp({
      useInfrastructure: true,
      infrastructure: {
        databaseUrl: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      }
    });

    expect(app).toBeDefined();

    await app.close();
  });

  it("returns ok", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok"
    });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));

    await app.close();
  });

  it("reuses a valid inbound x-request-id header", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-request-id": "req_123-abc"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("req_123-abc");

    await app.close();
  });

  it("replaces an invalid inbound x-request-id header", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-request-id": "bad request id"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).not.toBe("bad request id");
    expect(response.headers["x-request-id"]).toMatch(
      /^[A-Za-z0-9._-]{1,128}$/
    );

    await app.close();
  });

  it("writes structured request logs without sensitive headers or bodies", async () => {
    const collector = createLogCollector();
    const app = buildApp({
      logger: {
        level: "info",
        stream: collector.stream
      },
      useRateLimit: false
    });

    app.post("/logging-test", async (_request, reply) => {
      return reply.code(401).send({
        error: "missing_api_key"
      });
    });

    const response = await app.inject({
      method: "POST",
      url: "/logging-test",
      headers: {
        authorization: "Bearer secret-api-key",
        cookie: "auditrail_session=session-secret",
        "x-request-id": "req_test_123"
      },
      payload: {
        event: "user.deleted",
        metadata: {
          secret: "sensitive-metadata-value"
        }
      }
    });

    expect(response.statusCode).toBe(401);

    await app.close();

    const requestLog = collector
      .records()
      .find((entry) => entry.msg === "request_completed");

    expect(requestLog).toMatchObject({
      requestId: "req_test_123",
      method: "POST",
      route: "/logging-test",
      statusCode: 401,
      errorCode: "missing_api_key"
    });
    expect(requestLog?.durationMs).toEqual(expect.any(Number));
    expect(requestLog?.durationMs).toBeGreaterThanOrEqual(0);

    const serializedLogs = JSON.stringify(collector.records());
    expect(serializedLogs).not.toContain("secret-api-key");
    expect(serializedLogs).not.toContain("session-secret");
    expect(serializedLogs).not.toContain("sensitive-metadata-value");
  });

  it("returns API version metadata", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: API_BASE_PATH
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      basePath: "/api",
      latestVersion: "v1",
      defaultVersion: "v1",
      versions: [
        {
          version: "v1",
          path: "/api/v1"
        }
      ]
    });

    await app.close();
  });

  it("returns ok on the versioned health route", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/health`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok"
    });

    await app.close();
  });

  it("returns an OpenAPI document for the current version", async () => {
    const app = buildApp({
      useRateLimit: false
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/openapi.json`
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.openapi).toBe("3.0.3");
    expect(body.info).toMatchObject({
      title: "AuditTrail API",
      version: "v1"
    });
    expect(body.paths).toHaveProperty(`${API_VERSION_PREFIX}/events`);
    expect(body.paths).toHaveProperty(`${API_VERSION_PREFIX}/events/stats`);
    expect(body.paths).toHaveProperty(`${API_VERSION_PREFIX}/events/timeseries`);
    expect(body.paths).not.toHaveProperty(`${API_VERSION_PREFIX}/auth/magic-links`);
    expect(body.paths).not.toHaveProperty(
      `${API_VERSION_PREFIX}/organizations/{organizationId}/projects/{projectId}/api-keys`
    );

    await app.close();
  });

  it("can register auth routes with an injected service", async () => {
    const app = buildApp({
      auth: {
        cookie: {
          secure: false
        },
        service: createAuthServiceStub()
      },
      useRateLimit: false
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com"
      },
      url: `${API_VERSION_PREFIX}/auth/magic-links`
    });

    expect(response.statusCode).toBe(202);

    await app.close();
  });

  it("adds auth routes to OpenAPI when auth is registered", async () => {
    const app = buildApp({
      auth: {
        service: createAuthServiceStub()
      },
      useRateLimit: false
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/openapi.json`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().paths).toHaveProperty(
      `${API_VERSION_PREFIX}/auth/magic-links`
    );

    await app.close();
  });

  it("can register platform routes with an injected service", async () => {
    const app = buildApp({
      platform: {
        service: createPlatformServiceStub()
      },
      useRateLimit: false
    });

    app.decorateRequest("sessionUser");
    app.addHook("preHandler", async (request) => {
      request.sessionUser = {
        email: "user@example.com",
        id: "user-1"
      };
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations`
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it("can register API key routes with an injected service", async () => {
    const app = buildApp({
      apiKeys: {
        service: createApiKeyServiceStub()
      },
      useRateLimit: false
    });

    app.decorateRequest("sessionUser");
    app.addHook("preHandler", async (request) => {
      request.sessionUser = {
        email: "user@example.com",
        id: "user-1"
      };
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/org-1/projects/project-1/api-keys`
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it("adds API key routes to OpenAPI when registered", async () => {
    const app = buildApp({
      apiKeys: {
        service: createApiKeyServiceStub()
      },
      useRateLimit: false
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/openapi.json`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().paths).toHaveProperty(
      `${API_VERSION_PREFIX}/organizations/{organizationId}/projects/{projectId}/api-keys`
    );

    await app.close();
  });

  it("rejects missing runtime config values", () => {
    expect(() => requireRuntimeConfig(undefined, "TEST_VALUE")).toThrow(
      "missing_runtime_config:TEST_VALUE"
    );
  });
});

function createAuthServiceStub(): AuthService {
  return {
    async createSessionFromMagicLink() {
      throw new Error("not implemented");
    },
    async getSessionUser() {
      return undefined;
    },
    async requestMagicLink() {},
    async revokeSession() {}
  };
}

function createPlatformServiceStub(): PlatformService {
  return {
    async acceptInvitation() {
      throw new Error("not implemented");
    },
    async createOrganization() {
      throw new Error("not implemented");
    },
    async createProject() {
      throw new Error("not implemented");
    },
    async createProjectForUser() {
      throw new Error("not implemented");
    },
    async inviteMember() {
      throw new Error("not implemented");
    },
    async changeOrganizationPlanForUser() {
      throw new Error("not implemented");
    },
    async listOrganizationMembersForUser() {
      return [];
    },
    async listOrganizationsForUser() {
      return [];
    },
    async listProjectsForUser() {
      return [];
    },
    async revokeInvitation() {},
    async updateOnboardingStateForUser() {
      return {
        organizationId: "org-1",
        userId: "user-1"
      };
    }
  };
}

function createApiKeyServiceStub(): ApiKeyService {
  return {
    async createApiKeyForUser() {
      throw new Error("not implemented");
    },
    async listApiKeysForUser() {
      return [];
    },
    async revokeApiKeyForUser() {}
  };
}

function createLogCollector() {
  const lines: string[] = [];

  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      }
    }),
    records() {
      return lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    }
  };
}
