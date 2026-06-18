import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerApiKeyRoutes } from "../routes.js";
import type { ApiKeyService } from "../service.js";

describe("registerApiKeyRoutes", () => {
  it("lists API keys for the current user", async () => {
    const app = buildTestApp({
      async listApiKeysForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          projectId: "project-1",
          userId: "user-1"
        });

        return [
          {
            createdAt: "2026-06-18T10:00:00.000Z",
            id: "key-1",
            keyPrefix: "atlabc",
            name: "Production",
            projectId: "project-1",
            revoked: false
          }
        ];
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [
        {
          createdAt: "2026-06-18T10:00:00.000Z",
          id: "key-1",
          keyPrefix: "atlabc",
          name: "Production",
          projectId: "project-1",
          revoked: false
        }
      ]
    });
  });

  it("creates API keys for admins", async () => {
    const app = buildTestApp({
      async createApiKeyForUser(input) {
        expect(input).toEqual({
          name: "Production ingest",
          organizationId: "org-1",
          projectId: "project-1",
          userId: "user-1"
        });

        return {
          apiKey: {
            createdAt: "2026-06-18T10:00:00.000Z",
            id: "key-1",
            keyPrefix: "atlabc",
            name: "Production ingest",
            projectId: "project-1",
            revoked: false
          },
          rawKey: "atlabc_secret"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        name: "Production ingest"
      },
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().rawKey).toBe("atlabc_secret");
  });

  it("revokes API keys for admins", async () => {
    const app = buildTestApp({
      async revokeApiKeyForUser(input) {
        expect(input).toEqual({
          apiKeyId: "key-1",
          organizationId: "org-1",
          projectId: "project-1",
          userId: "user-1"
        });
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/organizations/org-1/projects/project-1/api-keys/key-1/revoke"
    });

    expect(response.statusCode).toBe(204);
  });

  it("requires a session", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("requires a session when revoking API keys", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "POST",
      url: "/organizations/org-1/projects/project-1/api-keys/key-1/revoke"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects invalid creation payloads", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {
        name: ""
      },
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Bad Request" });
  });

  it("maps forbidden errors to 403", async () => {
    const app = buildTestApp({
      async listApiKeysForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps forbidden create errors to 403", async () => {
    const app = buildTestApp({
      async createApiKeyForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        name: "Production ingest"
      },
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps forbidden revoke errors to 403", async () => {
    const app = buildTestApp({
      async revokeApiKeyForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/organizations/org-1/projects/project-1/api-keys/key-1/revoke"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps missing projects to 404", async () => {
    const app = buildTestApp({
      async createApiKeyForUser() {
        throw new Error("project_not_found");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        name: "Production ingest"
      },
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "project_not_found" });
  });

  it("maps missing projects on list to 404", async () => {
    const app = buildTestApp({
      async listApiKeysForUser() {
        throw new Error("project_not_found");
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "project_not_found" });
  });

  it("maps missing API keys to 404", async () => {
    const app = buildTestApp({
      async revokeApiKeyForUser() {
        throw new Error("api_key_not_found");
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/organizations/org-1/projects/project-1/api-keys/key-1/revoke"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "api_key_not_found" });
  });

  it("rejects invalid create route params", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {
        name: "Production ingest"
      },
      url: "/organizations//projects/project-1/api-keys"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_api_key_request" });
  });

  it("rejects invalid revoke route params", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      url: "/organizations/org-1/projects/project-1/api-keys//revoke"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_api_key_request" });
  });

  it("rethrows unexpected service errors", async () => {
    const app = buildTestApp({
      async revokeApiKeyForUser() {
        throw new Error("boom");
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/organizations/org-1/projects/project-1/api-keys/key-1/revoke"
    });

    expect(response.statusCode).toBe(500);
  });
});

function buildTestApp(
  overrides: Partial<ApiKeyService>,
  options: { session?: boolean } = {}
) {
  const app = Fastify();
  const useSession = options.session ?? true;

  app.decorateRequest("sessionUser");
  app.addHook("preHandler", async (request) => {
    request.sessionUser = useSession
      ? {
          email: "user@example.com",
          id: "user-1"
        }
      : undefined;
  });

  app.register(registerApiKeyRoutes, {
    service: createApiKeyServiceStub(overrides)
  });

  return app;
}

function createApiKeyServiceStub(overrides: Partial<ApiKeyService>): ApiKeyService {
  return {
    async createApiKeyForUser() {
      throw new Error("not implemented");
    },
    async listApiKeysForUser() {
      return [];
    },
    async revokeApiKeyForUser() {},
    ...overrides
  };
}
