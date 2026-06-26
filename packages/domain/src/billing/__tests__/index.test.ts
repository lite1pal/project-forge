import { describe, expect, it } from "vitest";

import {
  billingCheckoutIntentSchema,
  billingCustomerSchema,
  billingIntervalSchema,
  billingPlanSchema,
  billingPortalIntentSchema,
  billingStatusSchema,
  billingSubscriptionSchema,
  linkBillingPlanToEntitlementPlan
} from "../index.js";

describe("billing domain", () => {
  it("parses a valid billing customer", () => {
    expect(
      billingCustomerSchema.parse({
        email: "owner@example.com",
        id: "customer-1",
        provider: "stripe",
        providerCustomerId: "cus_123",
        subjectId: "org-1"
      })
    ).toEqual({
      email: "owner@example.com",
      id: "customer-1",
      provider: "stripe",
      providerCustomerId: "cus_123",
      subjectId: "org-1"
    });
  });

  it("parses a valid billing subscription", () => {
    expect(
      billingSubscriptionSchema.parse({
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        customerId: "customer-1",
        id: "subscription-1",
        planId: "pro-monthly",
        priceId: "price-1",
        provider: "stripe",
        providerSubscriptionId: "sub_123",
        status: "active",
        trialEndsAt: "2026-06-15T00:00:00.000Z"
      })
    ).toEqual({
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      currentPeriodStart: "2026-06-01T00:00:00.000Z",
      customerId: "customer-1",
      id: "subscription-1",
      planId: "pro-monthly",
      priceId: "price-1",
      provider: "stripe",
      providerSubscriptionId: "sub_123",
      status: "active",
      trialEndsAt: "2026-06-15T00:00:00.000Z"
    });
  });

  it("rejects an unsupported billing provider", () => {
    expect(() =>
      billingCustomerSchema.parse({
        id: "customer-1",
        provider: "paddle",
        providerCustomerId: "cus_123",
        subjectId: "org-1"
      })
    ).toThrow();
  });

  it("rejects an unsupported billing status", () => {
    expect(() =>
      billingStatusSchema.parse("paused")
    ).toThrow();
  });

  it("validates supported billing intervals", () => {
    expect(billingIntervalSchema.parse("month")).toBe("month");
    expect(() => billingIntervalSchema.parse("week")).toThrow();
  });

  it("links billing plans to entitlement plans generically", () => {
    const plan = billingPlanSchema.parse({
      entitlementPlanId: "entitlement-pro",
      id: "billing-pro-monthly",
      name: "Pro Monthly",
      provider: "stripe",
      providerProductId: "prod_123"
    });

    expect(linkBillingPlanToEntitlementPlan(plan)).toEqual({
      billingPlanId: "billing-pro-monthly",
      entitlementPlanId: "entitlement-pro"
    });
  });

  it("parses generic checkout and portal intents", () => {
    expect(
      billingCheckoutIntentSchema.parse({
        billingCustomerId: "customer-1",
        cancelUrl: "https://app.example.com/settings/billing",
        planId: "billing-pro-monthly",
        provider: "stripe",
        successUrl: "https://app.example.com/settings/billing?success=1"
      })
    ).toMatchObject({
      billingCustomerId: "customer-1",
      planId: "billing-pro-monthly",
      provider: "stripe"
    });

    expect(
      billingPortalIntentSchema.parse({
        billingCustomerId: "customer-1",
        provider: "stripe",
        returnUrl: "https://app.example.com/settings/billing"
      })
    ).toEqual({
      billingCustomerId: "customer-1",
      provider: "stripe",
      returnUrl: "https://app.example.com/settings/billing"
    });
  });
});
