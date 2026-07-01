import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { API_BASE_PATH, API_VERSION_PREFIX } from "../api-version.js";
import { buildApp, requireRuntimeConfig } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { ApiKeyService } from "../modules/api-keys/service.js";
import type { AuthService } from "../modules/auth/service.js";
import type { PlatformBillingService } from "../modules/platform/billing/service.js";
import type { PlatformService } from "../modules/platform/service.js";
import type { PlatformSupportService } from "../modules/platform/support/service.js";

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

  it("registers support lookup routes when a support service is provided", async () => {
    const app = buildApp({
      support: {
        service: {
          async getOrganizationDetail() {
            return {
              adminEmails: [],
              billing: {
                customer: null,
                subscription: null
              },
              createdAt: "2026-06-26T12:00:00.000Z",
              entitlement: {
                features: [],
                meterUsage: [],
                organizationId: "org-1",
                periodEnd: "2026-07-01T00:00:00.000Z",
                periodStart: "2026-06-01T00:00:00.000Z",
                planId: "starter",
                productId: "audit-events",
                usedDefaultPlan: true,
                usageLimits: []
              },
              id: "org-1",
              memberCount: 0,
              name: "Acme",
              ownerEmails: []
            };
          },
          async searchOrganizations() {
            return [];
          }
        } satisfies PlatformSupportService
      },
      useRateLimit: false
    });

    app.decorateRequest("sessionUser");
    app.addHook("preHandler", async (request) => {
      request.sessionUser = {
        email: "support@example.com",
        id: "user-1",
        internalRole: "support"
      };
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/support/organizations?query=acme`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ organizations: [] });

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

  it("hides unknown error messages in production responses while keeping x-request-id", async () => {
    const app = buildApp({
      nodeEnv: "production",
      useRateLimit: false
    });

    app.get("/production-error", async () => {
      throw new Error("database unavailable password=secret");
    });

    const response = await app.inject({
      method: "GET",
      url: "/production-error"
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.json()).toEqual({
      error: "internal_server_error"
    });
    expect(response.body).not.toContain("database unavailable");
    expect(response.body).not.toContain("password=secret");
    expect(response.body).not.toContain("stack");

    await app.close();
  });

  it("keeps a deterministic debug message for unknown errors in test mode", async () => {
    const app = buildApp({
      nodeEnv: "test",
      useRateLimit: false
    });

    app.get("/test-error", async () => {
      throw new Error("database unavailable");
    });

    const response = await app.inject({
      method: "GET",
      url: "/test-error"
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.json()).toEqual({
      error: "internal_server_error",
      message: "database unavailable"
    });

    await app.close();
  });

  it("logs unknown errors with safe metadata and a generic error code", async () => {
    const collector = createLogCollector();
    const app = buildApp({
      logger: {
        level: "info",
        stream: collector.stream
      },
      nodeEnv: "production",
      useRateLimit: false
    });

    app.get("/unknown-error-log", async () => {
      throw new Error("database unavailable password=secret");
    });

    const response = await app.inject({
      method: "GET",
      url: "/unknown-error-log",
      headers: {
        "x-request-id": "req_prod_error"
      }
    });

    expect(response.statusCode).toBe(500);

    await app.close();

    const errorLog = collector
      .records()
      .find((entry) => entry.msg === "unhandled_request_error");
    const completionLog = collector
      .records()
      .find((entry) => entry.msg === "request_completed");

    expect(errorLog).toMatchObject({
      errorCode: "internal_server_error",
      errorName: "Error",
      method: "GET",
      requestId: "req_prod_error",
      route: "/unknown-error-log"
    });
    expect(completionLog).toMatchObject({
      errorCode: "internal_server_error",
      method: "GET",
      requestId: "req_prod_error",
      route: "/unknown-error-log",
      statusCode: 500
    });

    const serializedLogs = JSON.stringify(collector.records());
    expect(serializedLogs).not.toContain("password=secret");
    expect(serializedLogs).not.toContain("database unavailable");
  });

  it("logs non-error thrown values by type without exposing their contents", async () => {
    const collector = createLogCollector();
    const app = buildApp({
      logger: {
        level: "info",
        stream: collector.stream
      },
      nodeEnv: "production",
      useRateLimit: false
    });

    app.get("/null-error-log", async () => {
      throw null;
    });

    const response = await app.inject({
      method: "GET",
      url: "/null-error-log",
      headers: {
        "x-request-id": "req_null_error"
      }
    });

    expect(response.statusCode).toBe(500);

    await app.close();

    const errorLog = collector
      .records()
      .find((entry) => entry.msg === "unhandled_request_error");

    expect(errorLog).toMatchObject({
      errorCode: "internal_server_error",
      errorName: "NonErrorThrown",
      method: "GET",
      requestId: "req_null_error",
      route: "/null-error-log",
      thrownValueType: "null"
    });

    const serializedLogs = JSON.stringify(collector.records());
    expect(serializedLogs).not.toContain("null-error-log\":null");
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
      products: [
        {
          id: "audit-events",
          name: "AuditTrail"
        },
        {
          id: "projects",
          name: "Projects"
        },
        {
          id: "todo",
          name: "Todo"
        }
      ],
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
      title: "Elioric Product API",
      version: "v1"
    });
    expect(body.paths).toHaveProperty(`${API_VERSION_PREFIX}/events`);
    expect(body.paths).toHaveProperty(`${API_VERSION_PREFIX}/events/stats`);
    expect(body.paths).toHaveProperty(`${API_VERSION_PREFIX}/events/timeseries`);
    expect(body.paths).toHaveProperty(
      `${API_VERSION_PREFIX}/organizations/{organizationId}/projects/workspace`
    );
    expect(body.paths).not.toHaveProperty(`${API_VERSION_PREFIX}/auth/magic-links`);
    expect(body.paths).not.toHaveProperty(
      `${API_VERSION_PREFIX}/organizations/{organizationId}/billing`
    );
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

  it("can register billing routes with an injected service", async () => {
    const app = buildApp({
      billing: {
        service: createPlatformBillingServiceStub()
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
      url: `${API_VERSION_PREFIX}/organizations/org-1/billing`
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

  it("adds billing routes to OpenAPI when registered", async () => {
    const app = buildApp({
      billing: {
        service: createPlatformBillingServiceStub()
      },
      useRateLimit: false
    });

    const response = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/openapi.json`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().paths).toHaveProperty(
      `${API_VERSION_PREFIX}/organizations/{organizationId}/billing`
    );
    expect(response.json().paths).toHaveProperty(
      `${API_VERSION_PREFIX}/organizations/{organizationId}/billing/checkout`
    );
    expect(response.json().paths).toHaveProperty(
      `${API_VERSION_PREFIX}/organizations/{organizationId}/billing/portal`
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
    async backfillInstalledProducts() {
      return {
        changedInstallations: 0,
        organizationCount: 0,
        productIds: [],
        unchangedInstallations: 0
      };
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

function createPlatformBillingServiceStub(): PlatformBillingService {
  return {
    async createCheckoutIntentForUser() {
      return {
        provider: "stripe",
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      };
    },
    async createPortalIntentForUser() {
      return {
        provider: "stripe",
        url: "https://billing.stripe.com/p/session/test_123"
      };
    },
    async getBillingStatusForUser(input) {
      return {
        customer: null,
        organizationId: input.organizationId,
        providerConfigurationStatus: "configured" as const,
        subscription: null
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
