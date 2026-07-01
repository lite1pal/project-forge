import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerPlatformSupportRoutes } from "../routes.js";
import type { PlatformSupportService } from "../service.js";

describe("registerPlatformSupportRoutes", () => {
  it("rejects unauthenticated support requests", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "GET",
      url: "/support/organizations?query=acme"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects non-support users", async () => {
    const app = buildTestApp({}, { role: "none" });

    const response = await app.inject({
      method: "GET",
      url: "/support/organizations?query=acme"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("searches organizations for support users", async () => {
    const calls: Array<{ limit?: number; query: string }> = [];
    const app = buildTestApp(
      {
        async searchOrganizations(input) {
          calls.push(input);
          return [
            {
              createdAt: "2026-06-26T12:00:00.000Z",
              id: "org-1",
              memberCount: 2,
              name: "Acme",
              ownerEmails: ["owner@example.com"]
            }
          ];
        }
      },
      { role: "support" }
    );

    const response = await app.inject({
      method: "GET",
      url: "/support/organizations?query=acme&limit=99"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      organizations: [
        {
          createdAt: "2026-06-26T12:00:00.000Z",
          id: "org-1",
          memberCount: 2,
          name: "Acme",
          ownerEmails: ["owner@example.com"]
        }
      ]
    });
    expect(calls).toEqual([{ limit: 99, query: "acme" }]);
  });

  it("searches organizations for admin users", async () => {
    const app = buildTestApp(
      {
        async searchOrganizations() {
          return [];
        }
      },
      { role: "admin" }
    );

    const response = await app.inject({
      method: "GET",
      url: "/support/organizations?query=acme"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ organizations: [] });
  });

  it("rejects short queries", async () => {
    const app = buildTestApp(
      {
        async searchOrganizations(input) {
          expect(input).toEqual({ limit: undefined, query: "ac" });
          throw new Error("invalid_support_query");
        }
      },
      { role: "support" }
    );

    const response = await app.inject({
      method: "GET",
      url: "/support/organizations?query=ac"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_support_lookup_request" });
  });

  it("returns safe organization detail summaries", async () => {
    const app = buildTestApp(
      {
        async getOrganizationDetail(organizationId) {
          expect(organizationId).toBe("org-1");

          return {
            adminEmails: ["admin@example.com"],
            billing: {
              customer: {
                createdAt: "2026-06-26T12:01:00.000Z",
                id: "customer-1",
                provider: "stripe",
                updatedAt: "2026-06-26T12:02:00.000Z"
              },
              subscription: {
                billingPlanId: "billing-growth-monthly",
                cancelAtPeriodEnd: false,
                createdAt: "2026-06-26T12:03:00.000Z",
                entitlementPlanId: "growth",
                id: "subscription-1",
                provider: "stripe",
                status: "active",
                updatedAt: "2026-06-26T12:04:00.000Z"
              }
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
            memberCount: 2,
            name: "Acme",
            ownerEmails: ["owner@example.com"]
          };
        }
      },
      { role: "support" }
    );

    const response = await app.inject({
      method: "GET",
      url: "/support/organizations/org-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      organization: {
        adminEmails: ["admin@example.com"],
        billing: {
          customer: {
            createdAt: "2026-06-26T12:01:00.000Z",
            id: "customer-1",
            provider: "stripe",
            updatedAt: "2026-06-26T12:02:00.000Z"
          },
          subscription: {
            billingPlanId: "billing-growth-monthly",
            cancelAtPeriodEnd: false,
            createdAt: "2026-06-26T12:03:00.000Z",
            entitlementPlanId: "growth",
            id: "subscription-1",
            provider: "stripe",
            status: "active",
            updatedAt: "2026-06-26T12:04:00.000Z"
          }
        },
        createdAt: "2026-06-26T12:00:00.000Z",
        entitlement: {
          features: [],
          meterUsage: [],
          organizationId: "org-1",
          periodEnd: "2026-07-01T00:00:00.000Z",
          periodStart: "2026-06-01T00:00:00.000Z",
          planId: "starter",
          usedDefaultPlan: true,
          usageLimits: []
        },
        id: "org-1",
        memberCount: 2,
        name: "Acme",
        ownerEmails: ["owner@example.com"]
      }
    });
  });

  it("returns 404 for missing organizations", async () => {
    const app = buildTestApp(
      {
        async getOrganizationDetail() {
          throw new Error("organization_not_found");
        }
      },
      { role: "support" }
    );

    const response = await app.inject({
      method: "GET",
      url: "/support/organizations/missing-org"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "organization_not_found" });
  });
});

function buildTestApp(
  overrides: Partial<PlatformSupportService>,
  options: { role?: "admin" | "none" | "support"; session?: boolean } = {}
) {
  const app = Fastify();
  app.decorateRequest("sessionUser");
  app.addHook("preHandler", async (request) => {
    if (options.session === false) {
      return;
    }

    request.sessionUser = {
      email: "user@example.com",
      id: "user-1",
      internalRole: options.role ?? "support"
    };
  });
  app.register(registerPlatformSupportRoutes, {
    service: createPlatformSupportServiceStub(overrides)
  });

  return app;
}

function createPlatformSupportServiceStub(
  overrides: Partial<PlatformSupportService>
): PlatformSupportService {
  return {
    async getOrganizationDetail(organizationId) {
      const result = await overrides.getOrganizationDetail?.(organizationId);

      if (result) {
        return result;
      }

      throw new Error("organization_not_found");
    },
    async searchOrganizations(input) {
      return (await overrides.searchOrganizations?.(input)) ?? [];
    }
  };
}
