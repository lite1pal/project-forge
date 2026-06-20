import type { ApiClient } from "@/src/lib/api/api-client";
import {
  createOrganizationResponseSchema,
  createProjectResponseSchema,
  organizationMembersResponseSchema,
  organizationsResponseSchema,
  projectsResponseSchema
} from "@/src/features/organizations/domain/schemas";

export function createOrganizationsClient(apiClient: ApiClient) {
  return {
    async createOrganization(name: string) {
      return createOrganizationResponseSchema.parse(
        await apiClient.request({
          body: { name },
          method: "POST",
          path: "/api/v1/organizations"
        })
      );
    },
    async createProject(organizationId: string, name: string) {
      return createProjectResponseSchema.parse(
        await apiClient.request({
          body: { name },
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/projects`
        })
      );
    },
    async listOrganizations() {
      return organizationsResponseSchema.parse(
        await apiClient.request({
          path: "/api/v1/organizations"
        })
      );
    },
    async listProjects(organizationId: string) {
      return projectsResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/projects`
        })
      );
    },
    async listMembers(organizationId: string) {
      return organizationMembersResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/members` as never
        })
      );
    }
  };
}
