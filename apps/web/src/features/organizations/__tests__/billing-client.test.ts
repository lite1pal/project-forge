import { describe, expect, it } from "vitest";

import type {
  ApiClient,
  ApiRequestOptions
} from "@/src/lib/api/api-client";
import { createBillingClient } from "@/src/features/organizations/api/billing-client";

describe("createBillingClient", () => {
  it("loads billing status through the API client", async () => {
    const requests: unknown[] = [];
    const client = createBillingClient(
      createRecordingApiClient(requests, {
        customer: null,
        organizationId: "org-1",
        providerConfigurationStatus: "not_configured",
        subscription: null
      })
    );

    await client.getBillingStatus("org-1");

    expect(requests).toEqual([
      {
        path: "/api/v1/organizations/org-1/billing"
      }
    ]);
  });

  it("submits checkout and portal requests through the API client", async () => {
    const requests: unknown[] = [];
    const client = createBillingClient(
      createRecordingApiClient(requests, {
        provider: "stripe",
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      })
    );

    await expect(
      client.createCheckoutIntent("org-1", {
      cancelUrl: "https://app.example.com/settings?organizationId=org-1",
      planId: "billing-self-serve",
      successUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).resolves.toEqual({
      provider: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_123"
    });
    await expect(
      client.createPortalIntent("org-1", {
        returnUrl: "https://app.example.com/settings?organizationId=org-1"
      })
    ).resolves.toEqual({
      provider: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_123"
    });

    expect(requests).toEqual([
      {
        body: {
          cancelUrl: "https://app.example.com/settings?organizationId=org-1",
          planId: "billing-self-serve",
          successUrl: "https://app.example.com/settings?organizationId=org-1"
        },
        method: "POST",
        path: "/api/v1/organizations/org-1/billing/checkout"
      },
      {
        body: {
          returnUrl: "https://app.example.com/settings?organizationId=org-1"
        },
        method: "POST",
        path: "/api/v1/organizations/org-1/billing/portal"
      }
    ]);
  });
});

function createRecordingApiClient(
  requests: unknown[],
  response: unknown
): ApiClient {
  return {
    async raw(options: ApiRequestOptions) {
      requests.push(options);
      return new Response(JSON.stringify(response), {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      });
    },
    async request<TResponse>(options: ApiRequestOptions) {
      requests.push(options);
      return response as TResponse;
    }
  };
}
