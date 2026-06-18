import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { Organization, Project } from "@/src/features/organizations/domain/schemas";

export interface WorkspaceSelection {
  organizationId?: string;
  projectId?: string;
}

export interface WorkspaceContext {
  activeOrganization?: Organization;
  activeOrganizationId?: string;
  activeProject?: Project;
  activeProjectId?: string;
  organizations: Organization[];
  projects: Project[];
}

export function resolveWorkspaceContext(
  currentUser: CurrentUserResponse,
  selection: WorkspaceSelection = {}
): WorkspaceContext {
  const organizations = currentUser.memberships.map(
    (membership) => membership.organization
  );
  const activeMembership =
    currentUser.memberships.find(
      (membership) => membership.organization.id === selection.organizationId
    ) ?? currentUser.memberships[0];
  const projects = activeMembership?.projects ?? [];
  const activeProject =
    projects.find((project) => project.id === selection.projectId) ?? projects[0];

  return {
    activeOrganization: activeMembership?.organization,
    activeOrganizationId: activeMembership?.organization.id,
    activeProject,
    activeProjectId: activeProject?.id,
    organizations,
    projects
  };
}
