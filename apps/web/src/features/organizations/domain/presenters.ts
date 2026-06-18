import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { Organization, Project } from "@/src/features/organizations/domain/schemas";
import { resolveWorkspaceContext, type WorkspaceSelection } from "@/src/features/organizations/domain/workspace";

export function toOrganizationOption(organization: Organization) {
  return {
    label: organization.name,
    value: organization.id
  };
}

export function toProjectOption(project: Project) {
  return {
    label: project.name,
    value: project.id
  };
}

export function toWorkspaceViewModel(
  currentUser: CurrentUserResponse,
  selection: WorkspaceSelection = {}
) {
  const workspace = resolveWorkspaceContext(currentUser, selection);

  return {
    activeOrganization: workspace.activeOrganization,
    activeProject: workspace.activeProject,
    memberships: currentUser.memberships.map((membership) => ({
      organization: membership.organization,
      projects: membership.projects,
      role: membership.role
    }))
  };
}
