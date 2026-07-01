import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  createApiProductRuntime,
  getProductApiOpenApiInfo,
  registerProductApiRoutes
} from "../product-module.js";

describe("API product module", () => {
  it("derives OpenAPI info from the product module", () => {
    expect(getProductApiOpenApiInfo()).toEqual({
      description:
        "Versioned Elioric product API. The canonical contract is /api/v1.",
      title: "Elioric Product API"
    });
  });

  it("registers the declared product API routes", async () => {
    const app = Fastify();

    await app.register(registerProductApiRoutes, {
      prefix: "/api/v1"
    });

    expect(app.hasRoute({ method: "POST", url: "/api/v1/events" })).toBe(true);
    expect(
      app.hasRoute({
        method: "GET",
        url: "/api/v1/organizations/:organizationId/projects/workspace"
      })
    ).toBe(true);

    await app.close();
  });

  it("lists both built-in registered products", () => {
    const runtime = createApiProductRuntime();

    expect(runtime.listRegisteredProducts()).toEqual([
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
    ]);
  });

  it("can describe and register multiple product modules through one runtime", async () => {
    const app = Fastify();
    const seenProductIds: string[] = [];
    const runtime = createApiProductRuntime(
      [
        {
          getRuntimeRegistrations() {
            return [
              {
                id: "alpha",
                surface: "api" as const,
                target: "alpha-routes"
              }
            ];
          },
          manifest: createTestManifest("alpha-product", "Alpha Product")
        },
        {
          getRuntimeRegistrations() {
            return [
              {
                id: "beta",
                surface: "api" as const,
                target: "beta-routes"
              }
            ];
          },
          manifest: createTestManifest("beta-product", "Beta Product")
        }
      ],
      {
        "alpha-routes": (targetApp, options) => {
          seenProductIds.push(options.productId);
          targetApp.get("/alpha", async () => ({ ok: true }));
        },
        "beta-routes": (targetApp, options) => {
          seenProductIds.push(options.productId);
          targetApp.get("/beta", async () => ({ ok: true }));
        }
      }
    );

    expect(runtime.listRegisteredProducts()).toEqual([
      {
        id: "alpha-product",
        name: "Alpha Product"
      },
      {
        id: "beta-product",
        name: "Beta Product"
      }
    ]);

    await runtime.registerProductApiRoutes(app, {
      prefix: "/api/v1"
    });

    expect(seenProductIds).toEqual(["alpha-product", "beta-product"]);
    expect(app.hasRoute({ method: "GET", url: "/alpha" })).toBe(true);
    expect(app.hasRoute({ method: "GET", url: "/beta" })).toBe(true);

    await app.close();
  });
});

function createTestManifest(id: string, name: string) {
  return {
    capabilities: [],
    emptyStateCopy: {
      emptyStateDescription: `${name} empty`,
      emptyStateTitle: `${name} title`
    },
    id,
    name,
    navItems: [],
    onboardingContent: {
      completeSummaryDescription: "done",
      dismissFromSidebarLabel: "dismiss",
      eyebrow: "Setup",
      incompleteSummaryDescription: "todo",
      showInSidebarLabel: "show",
      stepContent: [],
      title: `${name} setup`
    },
    onboardingSteps: [],
    resources: [],
    runtime: {
      registrations: []
    },
    usageMeters: []
  } as const;
}
