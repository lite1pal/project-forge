import type { ApiClient } from "@/src/lib/api/api-client";
import { customerRecordSchema } from "@/src/features/customer/domain/schemas";
import { z } from "zod";

const customerListResponseSchema = z.object({
  items: z.array(customerRecordSchema)
});

export function createResourceClient(apiClient: ApiClient) {
  return {
    async create(organizationId: string, body: Record<string, unknown>) {
      return customerRecordSchema.parse(
        await apiClient.request({
          body,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/customers` as never
        })
      );
    },
    async get(organizationId: string, id: string) {
      return customerRecordSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/customers/${id}` as never
        })
      );
    },
    async list(organizationId: string) {
      return customerListResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/customers` as never
        })
      );
    },
    async update(organizationId: string, id: string, body: Record<string, unknown>) {
      return customerRecordSchema.parse(
        await apiClient.request({
          body,
          method: "PATCH",
          path: `/api/v1/organizations/${organizationId}/customers/${id}` as never
        })
      );
    }
  };
}
