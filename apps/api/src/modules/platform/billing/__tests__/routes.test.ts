import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { BillingProviderNotConfiguredError } from "../errors.js";
import { registerPlatformBillingRoutes } from "../routes.js";
import type { PlatformBillingService } from "../service.js";

describe("registerPlatformBillingRoutes", () => {
  it("returns billing status for authorized organization members", async () => {
    const app = buildTestApp({
      async getBillingStatusForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          userId: "user-1"
        });

        return {
          customer: {
            createdAt: "2026-06-26T12:00:00.000Z",
            id: "customer-1",
            provider: "stripe",
            providerCustomerId: "cus_123",
            updatedAt: "2026-06-26T12:00:00.000Z"
          },
          organizationId: "org-1",
          providerConfigurationStatus: "configured",
          subscription: {
            billingCustomerId: "customer-1",
            billingPlanId: "billing-growth-monthly",
            cancelAtPeriodEnd: false,
            createdAt: "2026-06-26T12:00:00.000Z",
            entitlementPlanId: "growth",
            id: "subscription-1",
            provider: "stripe",
            providerPriceId: "price_123",
            providerSubscriptionId: "sub_123",
            status: "active",
            updatedAt: "2026-06-26T12:00:00.000Z"
          }
        };
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/billing"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      customer: {
        providerCustomerId: "cus_123"
      },
      organizationId: "org-1",
      providerConfigurationStatus: "configured",
      subscription: {
        providerSubscriptionId: "sub_123",
        status: "active"
      }
    });
  });

  it("rejects unauthenticated billing status requests", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/billing"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects unauthorized organization billing status requests", async () => {
    const app = buildTestApp({
      async getBillingStatusForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-2/billing"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("returns a session link for checkout intents", async () => {
    const app = buildTestApp({
      async createCheckoutIntentForUser(input) {
        expect(input).toEqual({
          cancelUrl: "https://app.example.com/settings/billing",
          organizationId: "org-1",
          planId: "billing-growth-monthly",
          priceId: undefined,
          successUrl: "https://app.example.com/settings/billing?success=1",
          userEmail: "user@example.com",
          userId: "user-1"
        });

        return {
          provider: "stripe",
          url: "https://checkout.stripe.com/c/pay/cs_test_123"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        cancelUrl: "https://app.example.com/settings/billing",
        planId: "billing-growth-monthly",
        successUrl: "https://app.example.com/settings/billing?success=1"
      },
      url: "/organizations/org-1/billing/checkout"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      provider: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_123"
    });
  });

  it("returns a session link for portal intents", async () => {
    const app = buildTestApp({
      async createPortalIntentForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          returnUrl: "https://app.example.com/settings/billing",
          userId: "user-1"
        });

        return {
          provider: "stripe",
          url: "https://billing.stripe.com/p/session/test_123"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        returnUrl: "https://app.example.com/settings/billing"
      },
      url: "/organizations/org-1/billing/portal"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      provider: "stripe",
      url: "https://billing.stripe.com/p/session/test_123"
    });
  });

  it("returns a stable error when the portal customer is missing", async () => {
    const app = buildTestApp({
      async createPortalIntentForUser() {
        throw new Error("billing_customer_not_found");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        returnUrl: "https://app.example.com/settings/billing"
      },
      url: "/organizations/org-1/billing/portal"
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "billing_customer_not_found"
    });
  });

  it("returns a stable not-configured error for provider adapter failures", async () => {
    const app = buildTestApp({
      async createCheckoutIntentForUser() {
        throw new BillingProviderNotConfiguredError("stripe");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        cancelUrl: "https://app.example.com/settings/billing",
        planId: "billing-growth-monthly",
        successUrl: "https://app.example.com/settings/billing?success=1"
      },
      url: "/organizations/org-1/billing/checkout"
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toEqual({
      error: "billing_provider_not_configured"
    });
  });

  it("rejects unauthenticated checkout and portal requests", async () => {
    const app = buildTestApp({}, { session: false });

    const checkoutResponse = await app.inject({
      method: "POST",
      payload: {
        cancelUrl: "https://app.example.com/settings/billing",
        planId: "billing-growth-monthly",
        successUrl: "https://app.example.com/settings/billing?success=1"
      },
      url: "/organizations/org-1/billing/checkout"
    });
    const portalResponse = await app.inject({
      method: "POST",
      payload: {
        returnUrl: "https://app.example.com/settings/billing"
      },
      url: "/organizations/org-1/billing/portal"
    });

    expect(checkoutResponse.statusCode).toBe(401);
    expect(checkoutResponse.json()).toEqual({ error: "missing_session" });
    expect(portalResponse.statusCode).toBe(401);
    expect(portalResponse.json()).toEqual({ error: "missing_session" });
  });

  it("rejects invalid billing request bodies", async () => {
    const app = buildTestApp({});

    const checkoutResponse = await app.inject({
      method: "POST",
      payload: {
        planId: "",
        priceId: "price_123"
      },
      url: "/organizations/org-1/billing/checkout"
    });
    const portalResponse = await app.inject({
      method: "POST",
      payload: {},
      url: "/organizations/org-1/billing/portal"
    });

    expect(checkoutResponse.statusCode).toBe(400);
    expect(checkoutResponse.json()).toEqual({ error: "invalid_billing_request" });
    expect(portalResponse.statusCode).toBe(400);
    expect(portalResponse.json()).toEqual({ error: "invalid_billing_request" });
  });
});

function buildTestApp(
  overrides: Partial<PlatformBillingService>,
  options: { session?: boolean } = {}
) {
  const app = Fastify();
  app.decorateRequest("sessionUser");
  app.addHook("preHandler", async (request) => {
    if (options.session === false) {
      return;
    }

    request.sessionUser = {
      email: "user@example.com",
      id: "user-1"
    };
  });
  app.register(registerPlatformBillingRoutes, {
    service: createPlatformBillingServiceStub(overrides)
  });

  return app;
}

function createPlatformBillingServiceStub(
  overrides: Partial<PlatformBillingService>
): PlatformBillingService {
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
        providerConfigurationStatus: "configured",
        subscription: null
      };
    },
    ...overrides
  };
}
