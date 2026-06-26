import { describe, expect, it } from "vitest";

import {
  createPlatformBillingService
} from "../service.js";
import { BillingCustomerNotFoundError } from "../errors.js";

describe("createPlatformBillingService", () => {
  it("returns persisted billing status for authorized users", async () => {
    const service = createPlatformBillingService({
      async findBillingCustomerByOrganization() {
        return {
          createdAt: "2026-06-26T12:00:00.000Z",
          id: "customer-1",
          organizationId: "org-1",
          provider: "stripe",
          providerCustomerId: "cus_123",
          updatedAt: "2026-06-26T12:00:00.000Z"
        };
      },
      async findCurrentSubscriptionByOrganization() {
        return {
          billingCustomerId: "customer-1",
          billingPlanId: "billing-growth-monthly",
          cancelAtPeriodEnd: false,
          createdAt: "2026-06-26T12:00:00.000Z",
          currentPeriodEnd: "2026-07-01T00:00:00.000Z",
          currentPeriodStart: "2026-06-01T00:00:00.000Z",
          entitlementPlanId: "growth",
          id: "subscription-1",
          organizationId: "org-1",
          provider: "stripe",
          providerPriceId: "price_123",
          providerSubscriptionId: "sub_123",
          status: "active",
          updatedAt: "2026-06-26T12:00:00.000Z"
        };
      },
      async findMembership() {
        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "viewer",
          userId: "user-1"
        };
      }
    });

    await expect(
      service.getBillingStatusForUser({
        organizationId: "org-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      customer: {
        createdAt: "2026-06-26T12:00:00.000Z",
        id: "customer-1",
        provider: "stripe",
        providerCustomerId: "cus_123",
        updatedAt: "2026-06-26T12:00:00.000Z"
      },
      organizationId: "org-1",
      providerConfigurationStatus: "not_configured",
      subscription: {
        billingCustomerId: "customer-1",
        billingPlanId: "billing-growth-monthly",
        cancelAtPeriodEnd: false,
        createdAt: "2026-06-26T12:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        entitlementPlanId: "growth",
        id: "subscription-1",
        provider: "stripe",
        providerPriceId: "price_123",
        providerProductId: undefined,
        providerSubscriptionId: "sub_123",
        status: "active",
        updatedAt: "2026-06-26T12:00:00.000Z"
      }
    });
  });

  it("returns null billing state when no customer or subscription exists", async () => {
    const service = createPlatformBillingService({
      async findBillingCustomerByOrganization() {
        return undefined;
      },
      async findCurrentSubscriptionByOrganization() {
        return undefined;
      },
      async findMembership() {
        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "member",
          userId: "user-1"
        };
      }
    });

    await expect(
      service.getBillingStatusForUser({
        organizationId: "org-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      customer: null,
      organizationId: "org-1",
      providerConfigurationStatus: "not_configured",
      subscription: null
    });
  });

  it("rejects users who are not members of the organization", async () => {
    const service = createPlatformBillingService({
      async findBillingCustomerByOrganization() {
        return undefined;
      },
      async findCurrentSubscriptionByOrganization() {
        return undefined;
      },
      async findMembership() {
        return undefined;
      }
    });

    await expect(
      service.getBillingStatusForUser({
        organizationId: "org-1",
        userId: "user-1"
      })
    ).rejects.toThrow("forbidden");
  });

  it("throws a provider-not-configured error for checkout intents after auth", async () => {
    const service = createPlatformBillingService({
      async findBillingCustomerByOrganization() {
        return undefined;
      },
      async findCurrentSubscriptionByOrganization() {
        return undefined;
      },
      async findMembership() {
        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "admin",
          userId: "user-1"
        };
      }
    }, {
      adapter: {
        async createCheckoutSession(input) {
          expect(input).toEqual({
            cancelUrl: "https://app.example.com/settings/billing",
            customerEmail: "owner@example.com",
            organizationId: "org-1",
            planId: "starter",
            priceId: undefined,
            providerCustomerId: undefined,
            successUrl: "https://app.example.com/settings/billing?success=1"
          });

          return {
            provider: "stripe",
            url: "https://checkout.stripe.com/c/pay/cs_test_123"
          };
        },
        async createPortalSession() {
          throw new Error("not used");
        },
        getConfigurationStatus() {
          return "configured" as const;
        },
        provider: "stripe" as const
      }
    });

    await expect(
      service.createCheckoutIntentForUser({
        cancelUrl: "https://app.example.com/settings/billing",
        organizationId: "org-1",
        planId: "starter",
        successUrl: "https://app.example.com/settings/billing?success=1",
        userEmail: "owner@example.com",
        userId: "user-1"
      })
    ).resolves.toEqual({
      provider: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_123"
    });
  });

  it("throws when opening the portal without a persisted billing customer", async () => {
    const service = createPlatformBillingService({
      async findBillingCustomerByOrganization() {
        return undefined;
      },
      async findCurrentSubscriptionByOrganization() {
        return undefined;
      },
      async findMembership() {
        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "owner",
          userId: "user-1"
        };
      }
    });

    await expect(
      service.createPortalIntentForUser({
        organizationId: "org-1",
        returnUrl: "https://app.example.com/settings/billing",
        userId: "user-1"
      })
    ).rejects.toBeInstanceOf(BillingCustomerNotFoundError);
  });

  it("uses the persisted provider customer when creating a portal session", async () => {
    const service = createPlatformBillingService(
      {
        async findBillingCustomerByOrganization() {
          return {
            createdAt: "2026-06-26T12:00:00.000Z",
            id: "customer-1",
            organizationId: "org-1",
            provider: "stripe",
            providerCustomerId: "cus_123",
            updatedAt: "2026-06-26T12:00:00.000Z"
          };
        },
        async findCurrentSubscriptionByOrganization() {
          return undefined;
        },
        async findMembership() {
          return {
            id: "membership-1",
            organizationId: "org-1",
            role: "owner",
            userId: "user-1"
          };
        }
      },
      {
        adapter: {
          async createCheckoutSession() {
            throw new Error("not used");
          },
          async createPortalSession(input) {
            expect(input).toEqual({
              providerCustomerId: "cus_123",
              returnUrl: "https://app.example.com/settings/billing"
            });

            return {
              provider: "stripe",
              url: "https://billing.stripe.com/p/session/test_123"
            };
          },
          getConfigurationStatus() {
            return "configured" as const;
          },
          provider: "stripe" as const
        }
      }
    );

    await expect(
      service.createPortalIntentForUser({
        organizationId: "org-1",
        returnUrl: "https://app.example.com/settings/billing",
        userId: "user-1"
      })
    ).resolves.toEqual({
      provider: "stripe",
      url: "https://billing.stripe.com/p/session/test_123"
    });
  });
});
