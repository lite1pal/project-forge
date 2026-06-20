import { describe, expect, it } from "vitest";

import type { AppDatabase } from "../../../plugins/database.js";
import { createPostgresPlatformRepo } from "../postgres-repo.js";

describe("createPostgresPlatformRepo", () => {
  it("creates platform records", async () => {
    const db = createFakeDb([
      { id: "org-1", name: "Acme" },
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

  it("loads user membership contexts", async () => {
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

    await expect(repo.listUserMembershipContexts("user-1")).resolves.toEqual([
      {
        membership: {
          id: "membership-1",
          organizationId: "org-1",
          role: "owner",
          userId: "user-1"
        },
        organization: {
          id: "org-1",
          name: "Acme"
        },
        projects: [
          {
            id: "project-1",
            name: "Production",
            organizationId: "org-1"
          }
        ]
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
            name: "Acme"
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
});

function createFakeDb(
  insertResults: unknown[],
  selectResults: {
    contextRows?: unknown[];
    invitationRows?: unknown[];
    memberRows?: unknown[];
    membershipRows?: unknown[];
    organizationRows?: unknown[];
    projectRows?: unknown[];
  } = {}
): AppDatabase & { updates: unknown[] } {
  const results = [...insertResults];
  const updates: unknown[] = [];
  const contextRows = [...(selectResults.contextRows ?? [])];
  const invitationRows = [...(selectResults.invitationRows ?? [])];
  const selectQueue = [
    selectResults.invitationRows ? { kind: "limit", rows: invitationRows } : undefined,
    selectResults.invitationRows
      ? { kind: "limit", rows: [...invitationRows] }
      : undefined,
    selectResults.membershipRows
      ? { kind: "limit", rows: selectResults.membershipRows }
      : undefined,
    selectResults.organizationRows
      ? { kind: "join", rows: selectResults.organizationRows }
      : undefined,
    selectResults.contextRows ? { kind: "join", rows: contextRows } : undefined,
    selectResults.projectRows
      ? { kind: "where", rows: selectResults.projectRows }
      : undefined,
    selectResults.memberRows
      ? { kind: "join", rows: selectResults.memberRows }
      : undefined
  ].filter(
    (
      item
    ): item is {
      kind: "join" | "limit" | "where";
      rows: unknown[];
    } => Boolean(item)
  );

  return {
    updates,
    insert() {
      return {
        values() {
          return {
            async returning() {
              return [results.shift()];
            }
          };
        }
      };
    },
    select() {
      const next = selectQueue.shift() ?? { kind: "where", rows: [] };

      if (next.kind === "limit") {
        return {
          from() {
            return {
              where() {
                return {
                  async limit() {
                    return next.rows;
                  }
                };
              }
            };
          }
        };
      }

      if (next.kind === "join") {
        return {
          from() {
            return {
              innerJoin() {
                return {
                  async where() {
                    return next.rows;
                  }
                };
              }
            };
          }
        };
      }

      return {
        from() {
          return {
            async where() {
              return next.rows;
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
