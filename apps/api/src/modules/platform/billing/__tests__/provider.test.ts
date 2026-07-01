import { describe, expect, it, vi } from "vitest";

import { BillingProviderNotConfiguredError } from "../errors.js";
import {
  createNoopBillingProviderAdapter,
  createStripeBillingProviderAdapter
} from "../provider.js";

describe("billing provider adapters", () => {
  it("reports a noop provider as not configured", async () => {
    const adapter = createNoopBillingProviderAdapter();

    expect(adapter.getConfigurationStatus()).toBe("not_configured");
    await expect(
      adapter.createCheckoutSession({
        cancelUrl: "https://app.example.com/settings?organizationId=org-1",
        organizationId: "org-1",
        planId: "starter",
        productId: "audit-events",
        successUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).rejects.toBeInstanceOf(BillingProviderNotConfiguredError);
  });

  it("creates a Stripe checkout session using the configured price map", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_123" }), {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      })
    );
    const adapter = createStripeBillingProviderAdapter({
      fetch: fetchMock as typeof fetch,
      priceIdsByPlanId: {
        growth: "price_growth",
        scale: "price_scale",
        starter: "price_starter"
      },
      secretKey: "sk_test_123"
    });

    await expect(
      adapter.createCheckoutSession({
        cancelUrl: "https://app.example.com/settings?organizationId=org-1",
        customerEmail: "owner@example.com",
        organizationId: "org-1",
        planId: "growth",
        productId: "audit-events",
        successUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).resolves.toEqual({
      provider: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_123"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/checkout/sessions",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("creates a Stripe portal session for an existing provider customer", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: "https://billing.stripe.com/p/session/test_123" }), {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      })
    );
    const adapter = createStripeBillingProviderAdapter({
      fetch: fetchMock as typeof fetch,
      priceIdsByPlanId: {
        growth: "price_growth",
        scale: "price_scale",
        starter: "price_starter"
      },
      secretKey: "sk_test_123"
    });

    await expect(
      adapter.createPortalSession({
        providerCustomerId: "cus_123",
        returnUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).resolves.toEqual({
      provider: "stripe",
      url: "https://billing.stripe.com/p/session/test_123"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/billing_portal/sessions",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("uses an explicit Stripe price id when one is supplied", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_456" }), {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      })
    );
    const adapter = createStripeBillingProviderAdapter({
      fetch: fetchMock as typeof fetch,
      priceIdsByPlanId: {
        starter: "price_starter"
      },
      secretKey: "sk_test_123"
    });

    await expect(
      adapter.createCheckoutSession({
        cancelUrl: "https://app.example.com/settings?organizationId=org-1",
        organizationId: "org-1",
        planId: "starter",
        priceId: "price_override",
        productId: "audit-events",
        providerCustomerId: "cus_123",
        successUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).resolves.toEqual({
      provider: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_456"
    });

    const lastCall = fetchMock.mock.lastCall;
    expect(lastCall).toBeDefined();

    const [, request] = lastCall as unknown as [string, RequestInit];
    const body = request.body as URLSearchParams;

    expect(body.get("customer")).toBe("cus_123");
    expect(body.get("customer_email")).toBeNull();
    expect(body.get("line_items[0][price]")).toBe("price_override");
  });

  it("rejects checkout session creation when no Stripe price is available", async () => {
    const adapter = createStripeBillingProviderAdapter({
      fetch: vi.fn() as typeof fetch,
      priceIdsByPlanId: {},
      secretKey: "sk_test_123"
    });

    await expect(
      adapter.createCheckoutSession({
        cancelUrl: "https://app.example.com/settings?organizationId=org-1",
        organizationId: "org-1",
        planId: "starter",
        productId: "audit-events",
        successUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).rejects.toBeInstanceOf(BillingProviderNotConfiguredError);
  });

  it("surfaces Stripe response failures and missing session urls", async () => {
    const failingAdapter = createStripeBillingProviderAdapter({
      fetch: vi.fn(async () => new Response("{}", { status: 502 })) as typeof fetch,
      priceIdsByPlanId: {
        starter: "price_starter"
      },
      secretKey: "sk_test_123"
    });
    const missingUrlAdapter = createStripeBillingProviderAdapter({
      fetch: vi.fn(async () =>
        new Response(JSON.stringify({ id: "cs_test_123" }), {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        })
      ) as typeof fetch,
      priceIdsByPlanId: {
        starter: "price_starter"
      },
      secretKey: "sk_test_123"
    });

    await expect(
      failingAdapter.createCheckoutSession({
        cancelUrl: "https://app.example.com/settings?organizationId=org-1",
        organizationId: "org-1",
        planId: "starter",
        productId: "audit-events",
        successUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).rejects.toThrow("billing_provider_request_failed:502");

    await expect(
      missingUrlAdapter.createPortalSession({
        providerCustomerId: "cus_123",
        returnUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).rejects.toThrow("billing_provider_session_missing_url");
  });
});
