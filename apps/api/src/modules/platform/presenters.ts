import type { CurrentUserContext } from "./context.js";

export function toCurrentUserResponse(context: CurrentUserContext) {
  return {
    memberships: context.memberships.map((item) => ({
      installedProducts: item.installedProducts,
      onboarding: item.onboarding,
      organization: item.organization,
      organizationId: item.organization.id,
      plan: item.plan,
      projects: item.projects,
      projectIds: item.projects.map((project) => project.id),
      role: item.membership.role
    })),
    user: {
      email: context.user.email,
      id: context.user.id,
      name: context.user.name
    }
  };
}
