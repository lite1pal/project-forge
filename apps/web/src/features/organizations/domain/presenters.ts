import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { Organization, Project } from "@/src/features/organizations/domain/schemas";

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

export function toWorkspaceViewModel(currentUser: CurrentUserResponse) {
  const firstMembership = currentUser.memberships[0];
  const firstProject = firstMembership?.projects[0];

  return {
    activeOrganization: firstMembership?.organization,
    activeProject: firstProject,
    memberships: currentUser.memberships.map((membership) => ({
      organization: membership.organization,
      projects: membership.projects,
      role: membership.role
    }))
  };
}
