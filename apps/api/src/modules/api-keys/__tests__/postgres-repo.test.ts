import { describe, expect, it } from "vitest";

import { createPostgresApiKeyRepo } from "../postgres-repo.js";

describe("createPostgresApiKeyRepo", () => {
  it("creates, lists, looks up, and revokes API keys", async () => {
    const db = createFakeDb({
      insertResults: [
        {
          createdAt: new Date("2026-06-18T10:00:00.000Z"),
          id: "key-1",
          keyPrefix: "atlabc",
          lastUsedAt: null,
          name: "Production ingest",
          projectId: "project-1",
          revoked: false
        }
      ],
      selectResults: [
        [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "admin",
            userId: "user-1"
          }
        ],
        [{ id: "project-1" }],
        [
          {
            createdAt: new Date("2026-06-18T10:00:00.000Z"),
            id: "key-2",
            keyPrefix: "atldef",
            lastUsedAt: new Date("2026-06-18T11:00:00.000Z"),
            name: "Background worker",
            projectId: "project-1",
            revoked: true
          }
        ],
        [{ id: "key-2" }],
        [],
        []
      ]
    });
    const repo = createPostgresApiKeyRepo(db.asDatabase());

    await expect(
      repo.create({
        keyHash: "hash",
        keyPrefix: "atlabc",
        name: "Production ingest",
        projectId: "project-1"
      })
    ).resolves.toEqual({
      createdAt: "2026-06-18T10:00:00.000Z",
      id: "key-1",
      keyPrefix: "atlabc",
      lastUsedAt: undefined,
      name: "Production ingest",
      projectId: "project-1",
      revoked: false
    });
    await expect(
      repo.findMembership({
        organizationId: "org-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      id: "membership-1",
      organizationId: "org-1",
      role: "admin",
      userId: "user-1"
    });
    await expect(
      repo.findProject({
        organizationId: "org-1",
        projectId: "project-1"
      })
    ).resolves.toEqual({ id: "project-1" });
    await expect(
      repo.listByProject({
        projectId: "project-1"
      })
    ).resolves.toEqual([
      {
        createdAt: "2026-06-18T10:00:00.000Z",
        id: "key-2",
        keyPrefix: "atldef",
        lastUsedAt: "2026-06-18T11:00:00.000Z",
        name: "Background worker",
        projectId: "project-1",
        revoked: true
      }
    ]);
    await expect(
      repo.revoke({
        apiKeyId: "key-2",
        projectId: "project-1"
      })
    ).resolves.toBe(true);
    await expect(
      repo.findMembership({
        organizationId: "org-1",
        userId: "missing-user"
      })
    ).resolves.toBeUndefined();
    await expect(
      repo.findProject({
        organizationId: "org-1",
        projectId: "missing-project"
      })
    ).resolves.toBeUndefined();

    expect(db.updates).toEqual([
      {
        revoked: true
      }
    ]);
  });
});

function createFakeDb(options: {
  insertResults?: unknown[];
  selectResults?: unknown[][];
}) {
  const insertResults = [...(options.insertResults ?? [])];
  const selectResults = [...(options.selectResults ?? [])];
  const updates: unknown[] = [];

  return {
    updates,
    asDatabase() {
      return {
        insert() {
          return {
            values() {
              return {
                async returning() {
                  return [insertResults.shift()];
                }
              };
            }
          };
        },
        select() {
          return {
            from() {
              return {
                where() {
                  async function resolveRows() {
                    return selectResults.shift() ?? [];
                  }

                  return {
                    async limit() {
                      return resolveRows();
                    },
                    orderBy() {
                      return {
                        async limit() {
                          return resolveRows();
                        },
                        then(resolve: (value: unknown[]) => void) {
                          resolve(selectResults.shift() ?? []);
                        }
                      };
                    },
                    then(resolve: (value: unknown[]) => void) {
                      resolve(selectResults.shift() ?? []);
                    }
                  };
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
                where() {
                  return {
                    returning: async () => selectResults.shift() ?? []
                  };
                }
              };
            }
          };
        }
      } as never;
    }
  };
}
