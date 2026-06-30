import { describe, expect, it } from "vitest";

import { toCurrentUserResponse } from "../presenters.js";

describe("toCurrentUserResponse", () => {
  it("includes organization and project context", () => {
    expect(
      toCurrentUserResponse({
        memberships: [
          {
            installedProducts: [
              {
                enabled: true,
                productId: "audit-events"
              }
            ],
            membership: {
              id: "membership-1",
              organizationId: "org-1",
              role: "admin",
              userId: "user-1"
            },
            onboarding: emptyOnboarding(),
            organization: {
              id: "org-1",
              name: "Acme"
            },
            plan: {
              id: "starter",
              includedEvents: 100000,
              name: "Starter",
              periodEnd: "2026-07-01T00:00:00.000Z",
              periodStart: "2026-06-01T00:00:00.000Z",
              remainingEvents: 99999,
              usedEvents: 1
            },
            projects: [
              {
                id: "project-1",
                name: "Production",
                organizationId: "org-1"
              }
            ]
          }
        ],
        user: {
          email: "user@example.com",
          id: "user-1",
          internalRole: "support"
        }
      })
    ).toEqual({
      memberships: [
        {
          installedProducts: [
            {
              enabled: true,
              productId: "audit-events"
            }
          ],
          onboarding: emptyOnboarding(),
          organization: {
            id: "org-1",
            name: "Acme"
          },
          organizationId: "org-1",
          plan: {
            id: "starter",
            includedEvents: 100000,
            name: "Starter",
            periodEnd: "2026-07-01T00:00:00.000Z",
            periodStart: "2026-06-01T00:00:00.000Z",
            remainingEvents: 99999,
            usedEvents: 1
          },
          projectIds: ["project-1"],
          projects: [
            {
              id: "project-1",
              name: "Production",
              organizationId: "org-1"
            }
          ],
          role: "admin"
        }
      ],
      user: {
        email: "user@example.com",
        id: "user-1"
      }
    });
  });
});

function emptyOnboarding() {
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
