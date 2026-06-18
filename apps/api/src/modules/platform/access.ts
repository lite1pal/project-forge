import { assertRole, type Membership } from "./service.js";

export interface WorkspaceAccessRepo {
  findMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<Membership | undefined>;
  findProject(input: {
    organizationId: string;
    projectId: string;
  }): Promise<{ id: string } | undefined>;
}

export interface WorkspaceAccessService {
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
