import type { ApiClient } from "@/src/lib/api/api-client";
import {
  createProjectWebhookResponseSchema,
  projectWebhookListResponseSchema,
  projectWebhookResponseSchema,
  rotateProjectWebhookSecretResponseSchema
} from "@/src/features/organizations/domain/schemas";

export function createProjectWebhooksClient(apiClient: ApiClient) {
  return {
    async createWebhook(
      organizationId: string,
      projectId: string,
      input: {
        subscribedEventTypes: string[];
        url: string;
      }
    ) {
      return createProjectWebhookResponseSchema.parse(
        await apiClient.request({
          body: input,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/projects/${projectId}/webhooks` as never
        })
      );
    },
    async deleteWebhook(
      organizationId: string,
      projectId: string,
      endpointId: string
    ) {
      await apiClient.request({
        method: "DELETE",
        path: `/api/v1/organizations/${organizationId}/projects/${projectId}/webhooks/${endpointId}` as never
      });
    },
    async listWebhooks(organizationId: string, projectId: string) {
      return projectWebhookListResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/projects/${projectId}/webhooks` as never
        })
      );
    },
    async rotateSecret(
      organizationId: string,
      projectId: string,
      endpointId: string
    ) {
      return rotateProjectWebhookSecretResponseSchema.parse(
        await apiClient.request({
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/projects/${projectId}/webhooks/${endpointId}/rotate-secret` as never
        })
      );
    },
    async updateWebhook(
      organizationId: string,
      projectId: string,
      endpointId: string,
      input: {
        enabled?: boolean;
        subscribedEventTypes?: string[];
        url?: string;
      }
    ) {
      return projectWebhookResponseSchema.parse(
        await apiClient.request({
          body: input,
          method: "PATCH",
          path: `/api/v1/organizations/${organizationId}/projects/${projectId}/webhooks/${endpointId}` as never
        })
      );
    }
  };
}
