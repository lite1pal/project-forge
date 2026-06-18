import type { ApiClient } from "../../../lib/api/api-client";
import {
  createApiKeyResponseSchema,
  listApiKeysResponseSchema
} from "../domain/schemas";

export function createApiKeysClient(apiClient: ApiClient) {
  return {
    async createApiKey(organizationId: string, projectId: string, name: string) {
      return createApiKeyResponseSchema.parse(
        await apiClient.request({
          body: { name },
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/projects/${projectId}/api-keys`
        })
      );
    },
    async listApiKeys(organizationId: string, projectId: string) {
      return listApiKeysResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/projects/${projectId}/api-keys`
        })
      );
    },
    async revokeApiKey(
      organizationId: string,
      projectId: string,
      apiKeyId: string
    ) {
      await apiClient.request({
        method: "POST",
        path: `/api/v1/organizations/${organizationId}/projects/${projectId}/api-keys/${apiKeyId}/revoke`
      });
    }
  };
}
