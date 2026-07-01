import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerCustomerRoutes } from "../routes.js";
import type { createCustomerService } from "../service.js";

describe("registerCustomerRoutes", () => {
  it("requires a session before listing customers", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/customers"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("lists customers for the current organization", async () => {
    const app = buildTestApp({
      async list(input) {
        expect(input).toEqual({
          cursor: undefined,
          limit: undefined,
          organizationId: "11111111-1111-4111-8111-111111111111",
          query: undefined
        });

        return [
          {
            createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      email: "person@example.com",
      isActive: true,
      status: "active",
      externalId: "11111111-1111-4111-8111-111111111111",
      lastContactedAt: "2026-06-29T00:00:00.000Z",
            id: "22222222-2222-4222-8222-222222222222",
            organizationId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-29T00:00:00.000Z"
          }
        ];
      }
    });

    const response = await app.inject({
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/customers"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      email: "person@example.com",
      isActive: true,
      status: "active",
      externalId: "11111111-1111-4111-8111-111111111111",
      lastContactedAt: "2026-06-29T00:00:00.000Z",
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-06-29T00:00:00.000Z"
        }
      ]
    });
  });

  it("maps forbidden organization access to 403", async () => {
    const app = buildTestApp({}, {
      accessError: new Error("forbidden")
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        name: "name value",
        email: "person@example.com",
        isActive: true,
        status: "active",
        externalId: "11111111-1111-4111-8111-111111111111",
        lastContactedAt: "2026-06-29T00:00:00.000Z",
      },
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/customers"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });
});

function buildTestApp(
  overrides: Partial<ReturnType<typeof createCustomerService>>,
  options: {
    accessError?: Error;
    session?: boolean;
  } = {}
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

  app.register(registerCustomerRoutes, {
    access: {
      async assertOrganizationAccess() {
        if (options.accessError) {
          throw options.accessError;
        }
      }
    },
    service: createCustomerServiceStub(overrides)
  });

  return app;
}

function createCustomerServiceStub(
  overrides: Partial<ReturnType<typeof createCustomerService>>
) {
  return {
    async create() {
      throw new Error("not implemented");
    },
    async get() {
      throw new Error("not implemented");
    },
    async list() {
      return [];
    },
    async update() {
      throw new Error("not implemented");
    },
    ...overrides
  };
}
