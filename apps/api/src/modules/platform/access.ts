import { assertRole, type Membership } from "./service.js";

export interface WorkspaceAccessRepo {
  findMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<Membership | undefined>;
  isOrganizationProductInstalled(input: {
    organizationId: string;
    productId: string;
  }): Promise<boolean>;
  findProject(input: {
    organizationId: string;
    projectId: string;
  }): Promise<{ id: string } | undefined>;
}

export interface WorkspaceAccessService {
  assertProductInstalledForOrganization(input: {
    organizationId: string;
    productId: string;
  }): Promise<void>;
  resolveTenantForUser(input: {
    organizationId: string;
    projectId: string;
    userId: string;
  }): Promise<{
    organizationId: string;
    projectId: string;
  }>;
}

export function createWorkspaceAccessService(
  repo: WorkspaceAccessRepo
): WorkspaceAccessService {
  return {
    async assertProductInstalledForOrganization(input) {
      const installed = await repo.isOrganizationProductInstalled({
        organizationId: input.organizationId,
        productId: input.productId
      });

      if (!installed) {
        throw new Error("product_not_installed");
      }
    },
    async resolveTenantForUser(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin", "member", "viewer"]);

      const project = await repo.findProject({
        organizationId: input.organizationId,
        projectId: input.projectId
      });

      if (!project) {
        throw new Error("project_not_found");
      }

      return {
        organizationId: input.organizationId,
        projectId: input.projectId
      };
    }
  };
}
