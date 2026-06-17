import type { Organization, Project } from "./schemas";

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
