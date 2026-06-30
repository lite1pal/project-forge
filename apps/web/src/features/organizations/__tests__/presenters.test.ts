import { describe, expect, it } from "vitest";

import { toWorkspaceViewModel } from "@/src/features/organizations/domain/presenters";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";

describe("toWorkspaceViewModel", () => {
  it("selects the first membership and project as active context", () => {
    const viewModel = toWorkspaceViewModel({
      memberships: [
        {
          installedProducts: [
            {
              enabled: true,
              productId: "audit-events"
            }
          ],
          onboarding: incompleteOnboarding(),
          organization: {
            id: "org-1",
            name: "Acme"
          },
          organizationId: "org-1",
          plan: starterPlan(),
          projectIds: ["project-1"],
          projects: [
            {
              id: "project-1",
              name: "Production",
              organizationId: "org-1"
            }
          ],
          role: "owner"
        }
      ],
      user: {
        email: "user@example.com",
        id: "user-1"
      }
    });

    expect(viewModel.activeOrganization?.name).toBe("Acme");
    expect(viewModel.activeProject?.name).toBe("Production");
    expect(viewModel.memberships).toHaveLength(1);
  });

  it("prefers the requested organization and project when present", () => {
    const viewModel = toWorkspaceViewModel(
      {
        memberships: [
          {
            installedProducts: [
              {
                enabled: true,
                productId: "audit-events"
              }
            ],
            onboarding: incompleteOnboarding(),
            organization: {
              id: "org-1",
              name: "Acme"
            },
            organizationId: "org-1",
            plan: starterPlan(),
            projectIds: ["project-1"],
            projects: [
              {
                id: "project-1",
                name: "Production",
                organizationId: "org-1"
              }
            ],
            role: "owner"
          },
          {
            installedProducts: [
              {
                enabled: true,
                productId: "audit-events"
              }
            ],
            onboarding: incompleteOnboarding(),
            organization: {
              id: "org-2",
              name: "Beta"
            },
            organizationId: "org-2",
            plan: growthPlan(),
            projectIds: ["project-2"],
            projects: [
              {
                id: "project-2",
                name: "Billing",
                organizationId: "org-2"
              }
            ],
            role: "member"
          }
        ],
        user: {
          email: "user@example.com",
          id: "user-1"
        }
      },
      {
        organizationId: "org-2",
        projectId: "project-2"
      }
    );

    expect(viewModel.activeOrganization?.name).toBe("Beta");
    expect(viewModel.activeProject?.name).toBe("Billing");
  });
});

describe("resolveWorkspaceContext", () => {
  it("returns the selected organization projects and ids", () => {
    const workspace = resolveWorkspaceContext(
      {
        memberships: [
          {
            installedProducts: [
              {
                enabled: true,
                productId: "audit-events"
              }
            ],
            onboarding: incompleteOnboarding(),
            organization: {
              id: "org-1",
              name: "Acme"
            },
            organizationId: "org-1",
            plan: starterPlan(),
            projectIds: ["project-1"],
            projects: [
              {
                id: "project-1",
                name: "Production",
                organizationId: "org-1"
              }
            ],
            role: "owner"
          },
          {
            installedProducts: [
              {
                enabled: true,
                productId: "audit-events"
              }
            ],
            onboarding: incompleteOnboarding(),
            organization: {
              id: "org-2",
              name: "Beta"
            },
            organizationId: "org-2",
            plan: growthPlan(),
            projectIds: ["project-2"],
            projects: [
              {
                id: "project-2",
                name: "Billing",
                organizationId: "org-2"
              }
            ],
            role: "member"
          }
        ],
        user: {
          email: "user@example.com",
          id: "user-1"
        }
      },
      {
        organizationId: "org-2"
      }
    );

    expect(workspace.activeOrganizationId).toBe("org-2");
    expect(workspace.activeProjectId).toBe("project-2");
    expect(workspace.organizations).toHaveLength(2);
    expect(workspace.projects).toEqual([
      {
        id: "project-2",
        name: "Billing",
        organizationId: "org-2"
      }
    ]);
    expect(workspace.activeOrganizationPlan?.id).toBe("growth");
  });
});

function starterPlan() {
  return {
    id: "starter" as const,
    includedEvents: 100000,
    name: "Starter",
    periodEnd: "2026-07-01T00:00:00.000Z",
    periodStart: "2026-06-01T00:00:00.000Z",
    remainingEvents: 99999,
    usedEvents: 1
  };
}

function growthPlan() {
  return {
    id: "growth" as const,
    includedEvents: 1000000,
    name: "Growth",
    periodEnd: "2026-07-01T00:00:00.000Z",
    periodStart: "2026-06-01T00:00:00.000Z",
    remainingEvents: 999000,
    usedEvents: 1000
  };
}

function incompleteOnboarding() {
  return {
    completedRequiredSteps: 0,
    isComplete: false,
    isDismissed: false,
    steps: [
      { id: "project_created" as const, required: true, status: "pending" as const },
      { id: "api_key_created" as const, required: true, status: "pending" as const },
      {
        id: "first_event_ingested" as const,
        required: true,
        status: "pending" as const
      },
      { id: "member_invited" as const, required: false, status: "pending" as const }
    ],
    totalRequiredSteps: 3
  };
}
