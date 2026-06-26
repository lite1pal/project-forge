import type { ApiClient } from "@/src/lib/api/api-client";
import {
  billingSessionLinkSchema,
  organizationBillingStatusSchema
} from "@/src/features/organizations/domain/schemas";

export function createBillingClient(apiClient: ApiClient) {
  return {
    async createCheckoutIntent(
      organizationId: string,
      input: {
        cancelUrl: string;
        planId: string;
        priceId?: string;
        successUrl: string;
      }
    ) {
      return billingSessionLinkSchema.parse(
        await apiClient.request({
          body: input,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/billing/checkout` as never
        })
      );
    },
    async createPortalIntent(
      organizationId: string,
      input: {
        returnUrl: string;
      }
    ) {
      return billingSessionLinkSchema.parse(
        await apiClient.request({
          body: input,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/billing/portal` as never
        })
      );
    },
    async getBillingStatus(organizationId: string) {
      return organizationBillingStatusSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/billing` as never
        })
      );
    }
  };
}
