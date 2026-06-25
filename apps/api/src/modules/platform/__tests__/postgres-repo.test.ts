import { describe, expect, it } from "vitest";

import type { AppDatabase } from "../../../plugins/database.js";
import { createPostgresPlatformRepo } from "../postgres-repo.js";

describe("createPostgresPlatformRepo", () => {
  it("creates platform records", async () => {
    const db = createFakeDb([
      { id: "org-1", name: "Acme", planId: "starter" },
      { id: "project-1", name: "Production", organizationId: "org-1" },
      {
        id: "membership-1",
        organizationId: "org-1",
        role: "owner",
        userId: "user-1"
      },
      {
        acceptedAt: null,
        email: "user@example.com",
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "invitation-1",
        organizationId: "org-1",
        revokedAt: null,
        role: "admin"
      }
    ]);
    const repo = createPostgresPlatformRepo(db);

    await expect(repo.createOrganization({ name: "Acme" })).resolves.toEqual({
      id: "org-1",
      name: "Acme"
    });
    await expect(
      repo.createProject({ name: "Production", organizationId: "org-1" })
    ).resolves.toEqual({
      id: "project-1",
      name: "Production",
      organizationId: "org-1"
    });
    await expect(
      repo.createMembership({
        organizationId: "org-1",
        role: "owner",
        userId: "user-1"
      })
    ).resolves.toEqual({
      id: "membership-1",
      organizationId: "org-1",
      role: "owner",
      userId: "user-1"
    });
    await expect(
      repo.createInvitation({
        email: "user@example.com",
        expiresAt: "2026-01-01T00:00:00.000Z",
        organizationId: "org-1",
        role: "admin",
        tokenHash: "hash"
      })
    ).resolves.toEqual({
      acceptedAt: undefined,
      email: "user@example.com",
      expiresAt: "2026-01-01T00:00:00.000Z",
      id: "invitation-1",
      organizationId: "org-1",
      revokedAt: undefined,
      role: "admin"
    });
  });

  it("reads and updates organization plans", async () => {
    const db = createFakeDb([], {
      planRows: [{ planId: "starter" }]
    });
    const repo = createPostgresPlatformRepo(db);

    await expect(repo.getOrganizationPlanId("org-1")).resolves.toBe("starter");

    await repo.updateOrganizationPlan({
      organizationId: "org-1",
      planId: "growth"
    });

    expect(db.updates).toContainEqual({
      planId: "growth"
    });
  });

  it("loads user membership contexts", async () => {
    const db = createFakeDb([], {
      apiKeyRows: [{ createdAt: new Date("2026-06-25T12:01:00.000Z") }],
      contextRows: [
        {
          membership: {
            id: "membership-1",
            organizationId: "org-1",
            role: "owner",
            userId: "user-1"
          },
          organization: {
            id: "org-1",
            name: "Acme",
            planId: "starter"
          }
        }
      ],
      eventRows: [{ createdAt: new Date("2026-06-25T12:02:00.000Z") }],
      onboardingStateRows: [{ dismissedAt: new Date("2026-06-25T12:03:00.000Z") }],
      projectMilestoneRows: [{ createdAt: new Date("2026-06-25T12:00:00.000Z") }],
      usageRows: [{ quantity: 12 }],
      onboardingInvitationRows: [{ createdAt: new Date("2026-06-25T12:04:00.000Z") }],
      projectRows: [
        {
          createdAt: new Date("2026-06-25T12:00:00.000Z"),
          id: "project-1",
          name: "Production",
          organizationId: "org-1"
        }
      ]
    });
    const repo = createPostgresPlatformRepo(db);

    await expect(repo.listUserMembershipContexts("user-1")).resolves.toEqual([
      {
        membership: {
          id: "membership-1",
          organizationId: "org-1",
          role: "owner",
          userId: "user-1"
        },
        onboarding: {
          completedRequiredSteps: 3,
          dismissedAt: "2026-06-25T12:03:00.000Z",
          isComplete: true,
          isDismissed: true,
          steps: [
            {
              completedAt: "2026-06-25T12:00:00.000Z",
              id: "project_created",
              required: true,
              status: "complete"
            },
            {
              completedAt: "2026-06-25T12:01:00.000Z",
              id: "api_key_created",
              required: true,
              status: "complete"
            },
            {
              completedAt: "2026-06-25T12:02:00.000Z",
              id: "first_event_ingested",
              required: true,
              status: "complete"
            },
            {
              completedAt: "2026-06-25T12:04:00.000Z",
              id: "member_invited",
              required: false,
              status: "complete"
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
        usedEvents: 12
      }
    ]);
  });

  it("deduplicates user membership contexts by organization", async () => {
    const db = createFakeDb([], {
      contextRows: [
        {
          membership: {
            id: "membership-1",
            organizationId: "org-1",
            role: "owner",
            userId: "user-1"
          },
          organization: {
            id: "org-1",
            name: "Acme",
            planId: "starter"
          }
        },
        {
          membership: {
            id: "membership-2",
            organizationId: "org-1",
            role: "member",
            userId: "user-1"
          },
          organization: {
            id: "org-1",
            name: "Acme",
            planId: "starter"
          }
        }
      ],
      usageRows: [{ quantity: 0 }],
      projectRows: [
        {
          id: "project-1",
          name: "Production",
          organizationId: "org-1"
        }
      ]
    });
    const repo = createPostgresPlatformRepo(db);

    await expect(repo.listUserMembershipContexts("user-1")).resolves.toHaveLength(1);
  });

  it("finds memberships and lists organization resources", async () => {
    const db = createFakeDb([], {
      memberRows: [
        {
          membership: {
            id: "membership-1",
            organizationId: "org-1",
            role: "admin",
            userId: "user-1"
          },
          user: {
            email: "user@example.com",
            id: "user-1",
            name: "Casey"
          }
        }
      ],
      membershipRows: [
        {
          id: "membership-1",
          organizationId: "org-1",
          role: "admin",
          userId: "user-1"
        }
      ],
      organizationRows: [
        {
          organization: {
            id: "org-1",
            name: "Acme"
          }
        }
      ],
      projectRows: [
        {
          id: "project-1",
          name: "Production",
          organizationId: "org-1"
        }
      ]
    });
    const repo = createPostgresPlatformRepo(db);

    await expect(
      repo.findMembership({ organizationId: "org-1", userId: "user-1" })
    ).resolves.toEqual({
      id: "membership-1",
      organizationId: "org-1",
      role: "admin",
      userId: "user-1"
    });
    await expect(repo.listOrganizationsForUser("user-1")).resolves.toEqual([
      {
        id: "org-1",
        name: "Acme"
      }
    ]);
    await expect(repo.listProjects("org-1")).resolves.toEqual([
      {
        id: "project-1",
        name: "Production",
        organizationId: "org-1"
      }
    ]);
    await expect(repo.listOrganizationMembers("org-1")).resolves.toEqual([
      {
        email: "user@example.com",
        id: "user-1",
        name: "Casey",
        role: "admin"
      }
    ]);
  });

  it("finds and updates invitations", async () => {
    const db = createFakeDb([], {
      invitationRows: [
        {
          acceptedAt: null,
          email: "user@example.com",
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
          id: "invitation-1",
          organizationId: "org-1",
          revokedAt: null,
          role: "member"
        }
      ]
    });
    const repo = createPostgresPlatformRepo(db);

    await expect(repo.findInvitationByTokenHash("hash")).resolves.toEqual({
      acceptedAt: undefined,
      email: "user@example.com",
      expiresAt: "2026-01-01T00:00:00.000Z",
      id: "invitation-1",
      organizationId: "org-1",
      revokedAt: undefined,
      role: "member"
    });
    await expect(
      repo.findPendingInvitationForEmail({
        email: "user@example.com",
        organizationId: "org-1"
      })
    ).resolves.toEqual({
      acceptedAt: undefined,
      email: "user@example.com",
      expiresAt: "2026-01-01T00:00:00.000Z",
      id: "invitation-1",
      organizationId: "org-1",
      revokedAt: undefined,
      role: "member"
    });
    await repo.acceptInvitation({
      acceptedAt: "2026-01-01T00:00:00.000Z",
      invitationId: "invitation-1"
    });
    await repo.revokeInvitation({
      invitationId: "invitation-1",
      revokedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(db.updates).toHaveLength(2);
  });

  it("returns undefined for missing pending invitations", async () => {
    const db = createFakeDb([], {
      invitationRows: []
    });
    const repo = createPostgresPlatformRepo(db);

    await expect(
      repo.findPendingInvitationForEmail({
        email: "missing@example.com",
        organizationId: "org-1"
      })
    ).resolves.toBeUndefined();
  });

  it("returns undefined when membership belongs to another user", async () => {
    const db = createFakeDb([], {
      membershipRows: [
        {
          id: "membership-1",
          organizationId: "org-1",
          role: "admin",
          userId: "user-2"
        }
      ]
    });
    const repo = createPostgresPlatformRepo(db);

    await expect(
      repo.findMembership({ organizationId: "org-1", userId: "user-1" })
    ).resolves.toBeUndefined();
  });

  it("stores per-user onboarding dismissal state", async () => {
    const db = createFakeDb([
      {
        dismissedAt: new Date("2026-06-25T12:00:00.000Z"),
        organizationId: "org-1",
        userId: "user-1"
      }
    ]);
    const repo = createPostgresPlatformRepo(db);

    await expect(
      repo.saveOrganizationOnboardingState({
        dismissedAt: "2026-06-25T12:00:00.000Z",
        organizationId: "org-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      dismissedAt: "2026-06-25T12:00:00.000Z",
      organizationId: "org-1",
      userId: "user-1"
    });
  });
});

function createFakeDb(
  insertResults: unknown[],
  selectResults: {
    contextRows?: unknown[];
    eventRows?: unknown[];
    invitationRows?: unknown[];
    memberRows?: unknown[];
    membershipRows?: unknown[];
    onboardingStateRows?: unknown[];
    organizationRows?: unknown[];
    onboardingInvitationRows?: unknown[];
    planRows?: unknown[];
    projectRows?: unknown[];
    projectMilestoneRows?: unknown[];
    apiKeyRows?: unknown[];
    usageRows?: unknown[];
  } = {}
): AppDatabase & { updates: unknown[] } {
  const results = [...insertResults];
  const updates: unknown[] = [];
  const contextRows = [...(selectResults.contextRows ?? [])];
  const invitationRows = [...(selectResults.invitationRows ?? [])];
  const planRows = [...(selectResults.planRows ?? [])];
  const selectQueue = [
    selectResults.invitationRows ? { kind: "limit", rows: invitationRows } : undefined,
    selectResults.invitationRows
      ? { kind: "limit", rows: [...invitationRows] }
      : undefined,
    selectResults.membershipRows
      ? { kind: "limit", rows: selectResults.membershipRows }
      : undefined,
    selectResults.planRows ? { kind: "limit", rows: planRows } : undefined,
    selectResults.organizationRows
      ? { kind: "join", rows: selectResults.organizationRows }
      : undefined,
    selectResults.contextRows ? { kind: "join", rows: contextRows } : undefined,
    selectResults.projectRows
      ? { kind: "where", rows: selectResults.projectRows }
      : undefined,
    selectResults.contextRows && selectResults.usageRows
      ? { kind: "limit", rows: selectResults.usageRows }
      : undefined,
    selectResults.contextRows && selectResults.projectMilestoneRows
      ? { kind: "ordered", rows: selectResults.projectMilestoneRows }
      : selectResults.contextRows
        ? { kind: "ordered", rows: [] }
        : undefined,
    selectResults.contextRows && selectResults.apiKeyRows
      ? { kind: "orderedJoin", rows: selectResults.apiKeyRows }
      : selectResults.contextRows
        ? { kind: "orderedJoin", rows: [] }
        : undefined,
    selectResults.contextRows && selectResults.eventRows
      ? { kind: "ordered", rows: selectResults.eventRows }
      : selectResults.contextRows
        ? { kind: "ordered", rows: [] }
        : undefined,
    selectResults.contextRows && selectResults.onboardingInvitationRows
      ? { kind: "ordered", rows: selectResults.onboardingInvitationRows }
      : selectResults.contextRows
        ? { kind: "ordered", rows: [] }
        : undefined,
    selectResults.contextRows && selectResults.onboardingStateRows
      ? { kind: "limit", rows: selectResults.onboardingStateRows }
      : selectResults.contextRows
        ? { kind: "limit", rows: [] }
        : undefined,
    selectResults.memberRows
      ? { kind: "join", rows: selectResults.memberRows }
      : undefined
  ].filter(
    (
      item
    ): item is {
      kind: "join" | "limit" | "ordered" | "orderedJoin" | "where";
      rows: unknown[];
    } => Boolean(item)
  );

  return {
    updates,
    insert() {
      return {
        values() {
          return {
            onConflictDoUpdate() {
              return {
                async returning() {
                  return [results.shift()];
                }
              };
            },
            async returning() {
              return [results.shift()];
            }
          };
        }
      };
    },
    select() {
      const next = selectQueue.shift() ?? { kind: "where", rows: [] };
      const buildScopedQuery = () => ({
        async limit() {
          return next.rows;
        },
        orderBy() {
          return {
            async limit() {
              return next.rows;
            }
          };
        },
        then(resolve: (value: unknown[]) => unknown) {
          return Promise.resolve(resolve(next.rows));
        }
      });

      return {
        from() {
          return {
            innerJoin() {
              return {
                where() {
                  return buildScopedQuery();
                }
              };
            },
            where() {
              return buildScopedQuery();
            }
          };
        }
      };
    },
    update() {
      return {
        set(value: unknown) {
          updates.push(value);
          return {
            async where() {}
          };
        }
      };
    }
  } as unknown as AppDatabase & { updates: unknown[] };
}
