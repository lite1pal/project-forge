import type { BillingProvider } from "@auditrail/domain/billing";

import { BillingProviderNotConfiguredError } from "./errors.js";

export interface BillingSessionLink {
  provider: BillingProvider;
  url: string;
}

export interface CreateBillingCheckoutSessionInput {
  cancelUrl: string;
  customerEmail?: string;
  organizationId: string;
  planId: string;
  priceId?: string;
  providerCustomerId?: string;
  successUrl: string;
}

export interface CreateBillingPortalSessionInput {
  providerCustomerId: string;
  returnUrl: string;
}

export interface PlatformBillingProviderAdapter {
  createCheckoutSession(
    input: CreateBillingCheckoutSessionInput
  ): Promise<BillingSessionLink>;
  createPortalSession(
    input: CreateBillingPortalSessionInput
  ): Promise<BillingSessionLink>;
  getConfigurationStatus(): "configured" | "not_configured";
  provider: BillingProvider;
}

export interface StripeBillingAdapterOptions {
  fetch?: typeof fetch;
  priceIdsByPlanId: Record<string, string>;
  secretKey: string;
}

const stripeApiBaseUrl = "https://api.stripe.com/v1";

export function createNoopBillingProviderAdapter(
  provider: BillingProvider = "stripe"
): PlatformBillingProviderAdapter {
  return {
    async createCheckoutSession() {
      throw new BillingProviderNotConfiguredError(provider);
    },
    async createPortalSession() {
      throw new BillingProviderNotConfiguredError(provider);
    },
    getConfigurationStatus() {
      return "not_configured";
    },
    provider
  };
}

export function createStripeBillingProviderAdapter(
  options: StripeBillingAdapterOptions
): PlatformBillingProviderAdapter {
  const fetcher = options.fetch ?? fetch;

  return {
    async createCheckoutSession(input) {
      const priceId = resolveStripePriceId(
        input.planId,
        input.priceId,
        options.priceIdsByPlanId
      );
      const body = new URLSearchParams({
        mode: "subscription",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.organizationId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "metadata[organization_id]": input.organizationId,
        "metadata[entitlement_plan_id]": input.planId
      });

      if (input.providerCustomerId) {
        body.set("customer", input.providerCustomerId);
      } else if (input.customerEmail) {
        body.set("customer_email", input.customerEmail);
      }

      return requestStripeSessionLink(fetcher, options.secretKey, "/checkout/sessions", body);
    },
    async createPortalSession(input) {
      const body = new URLSearchParams({
        customer: input.providerCustomerId,
        return_url: input.returnUrl
      });

      return requestStripeSessionLink(
        fetcher,
        options.secretKey,
        "/billing_portal/sessions",
        body
      );
    },
    getConfigurationStatus() {
      return "configured";
    },
    provider: "stripe"
  };
}

function resolveStripePriceId(
  planId: string,
  explicitPriceId: string | undefined,
  priceIdsByPlanId: Record<string, string>
) {
  if (explicitPriceId && explicitPriceId.startsWith("price_")) {
    return explicitPriceId;
  }

  const mappedPriceId = priceIdsByPlanId[planId];

  if (mappedPriceId) {
    return mappedPriceId;
  }

  throw new BillingProviderNotConfiguredError("stripe");
}

async function requestStripeSessionLink(
  fetcher: typeof fetch,
  secretKey: string,
  path: string,
  body: URLSearchParams
): Promise<BillingSessionLink> {
  const response = await fetcher(`${stripeApiBaseUrl}${path}`, {
    body,
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`billing_provider_request_failed:${response.status}`);
  }

  const payload = (await response.json()) as {
    url?: string;
  };

  if (!payload.url) {
    throw new Error("billing_provider_session_missing_url");
  }

  return {
    provider: "stripe",
    url: payload.url
  };
}
