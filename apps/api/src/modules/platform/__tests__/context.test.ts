import { describe, expect, it } from "vitest";

import { createCurrentUserContextService } from "../context.js";

describe("createCurrentUserContextService", () => {
  it("loads memberships for the current user", async () => {
    const service = createCurrentUserContextService({
      async listUserMembershipContexts(userId) {
        expect(userId).toBe("user-1");

        return [
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
              role: "owner",
              userId
            },
            onboarding: {
              completedRequiredSteps: 0,
              isComplete: false,
              isDismissed: false,
              steps: [
                {
                  id: "project_created",
                  required: true,
                  status: "pending"
                },
                {
                  id: "api_key_created",
                  required: true,
                  status: "pending"
                },
                {
                  id: "first_event_ingested",
                  required: true,
                  status: "pending"
                },
                {
                  id: "member_invited",
                  required: false,
                  status: "pending"
                }
              ],
              totalRequiredSteps: 3
            },
            organization: {
              id: "org-1",
              name: "Acme"
            },
            planId: "starter",
            projects: [
              {
                id: "project-1",
                name: "Production",
                organizationId: "org-1"
              }
            ],
            usedEvents: 42
          }
        ];
      }
    }, {
      now: () => new Date("2026-06-25T12:00:00.000Z")
    });

    await expect(
      service.getCurrentUserContext({
        email: "user@example.com",
        id: "user-1"
      })
    ).resolves.toMatchObject({
      memberships: [
        {
          installedProducts: [
            {
              enabled: true,
              productId: "audit-events"
            }
          ],
          organization: {
            name: "Acme"
          },
          onboarding: {
            completedRequiredSteps: 0,
            totalRequiredSteps: 3
          },
          plan: {
            id: "starter",
            includedEvents: 100000,
            name: "Starter",
            periodEnd: "2026-07-01T00:00:00.000Z",
            periodStart: "2026-06-01T00:00:00.000Z",
            remainingEvents: 99958,
            usedEvents: 42
          }
        }
      ]
    });
  });
});
