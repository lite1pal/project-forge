import { describe, expect, it } from "vitest";

import { createPostgresAuthRepo } from "../postgres-repo.js";

describe("createPostgresAuthRepo", () => {
  it("creates and consumes magic links", async () => {
    const db = createFakeDb({
      insertResults: [
        {
          consumedAt: null,
          email: "user@example.com",
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
          id: "magic-link-1",
          tokenHash: "hash"
        }
      ]
    });
    const repo = createPostgresAuthRepo(db.asDatabase());

    await expect(
      repo.createMagicLink({
        email: "user@example.com",
        expiresAt: "2026-01-01T00:00:00.000Z",
        tokenHash: "hash"
      })
    ).resolves.toEqual({
      consumedAt: undefined,
      email: "user@example.com",
      expiresAt: "2026-01-01T00:00:00.000Z",
      id: "magic-link-1",
      tokenHash: "hash"
    });
    await repo.consumeMagicLink("magic-link-1", "2026-01-01T00:01:00.000Z");

    expect(db.updates).toHaveLength(1);
  });

  it("creates sessions and revokes them", async () => {
    const db = createFakeDb({
      insertResults: [
        {
          expiresAt: new Date("2026-01-02T00:00:00.000Z"),
          id: "session-1",
          revokedAt: null,
          tokenHash: "hash",
          userId: "user-1"
        }
      ]
    });
    const repo = createPostgresAuthRepo(db.asDatabase());

    await expect(
      repo.createSession({
        expiresAt: "2026-01-02T00:00:00.000Z",
        tokenHash: "hash",
        userId: "user-1"
      })
    ).resolves.toEqual({
      expiresAt: "2026-01-02T00:00:00.000Z",
      id: "session-1",
      revokedAt: undefined,
      tokenHash: "hash",
      userId: "user-1"
    });
    await repo.revokeSession("session-1", "2026-01-01T00:01:00.000Z");

    expect(db.updates).toHaveLength(1);
  });

  it("finds auth records", async () => {
    const db = createFakeDb({
      selectResults: [
        [
          {
            consumedAt: new Date("2026-01-01T00:01:00.000Z"),
            email: "user@example.com",
            expiresAt: new Date("2026-01-01T00:00:00.000Z"),
            id: "magic-link-1",
            tokenHash: "hash"
          }
        ],
        [
          {
            expiresAt: new Date("2026-01-02T00:00:00.000Z"),
            id: "session-1",
            revokedAt: new Date("2026-01-01T00:01:00.000Z"),
            tokenHash: "hash",
            userId: "user-1"
          }
        ],
        [
          {
            email: "user@example.com",
            id: "user-1",
            name: null
          }
        ]
      ]
    });
    const repo = createPostgresAuthRepo(db.asDatabase());

    await expect(repo.findMagicLinkByEmail("user@example.com")).resolves.toEqual({
      consumedAt: "2026-01-01T00:01:00.000Z",
      email: "user@example.com",
      expiresAt: "2026-01-01T00:00:00.000Z",
      id: "magic-link-1",
      tokenHash: "hash"
    });
    expect(db.orderByCalls).toBe(1);
    await expect(repo.findSessionByHash("hash")).resolves.toMatchObject({
      revokedAt: "2026-01-01T00:01:00.000Z"
    });
    await expect(repo.findUserById("user-1")).resolves.toEqual({
      email: "user@example.com",
      id: "user-1",
      name: undefined
    });
  });

  it("creates users only when missing", async () => {
    const db = createFakeDb({
      insertResults: [
        {
          email: "user@example.com",
          id: "user-1",
          name: "User"
        }
      ],
      selectResults: [[], [{ email: "user@example.com", id: "user-1", name: "User" }]]
    });
    const repo = createPostgresAuthRepo(db.asDatabase());

    await expect(repo.findOrCreateUserByEmail("user@example.com")).resolves.toEqual({
      email: "user@example.com",
      id: "user-1",
      name: "User"
    });
    await expect(repo.findOrCreateUserByEmail("user@example.com")).resolves.toEqual({
      email: "user@example.com",
      id: "user-1",
      name: "User"
    });
  });
});

function createFakeDb(options: {
  insertResults?: unknown[];
  selectResults?: unknown[][];
}) {
  const insertResults = [...(options.insertResults ?? [])];
  const selectResults = [...(options.selectResults ?? [])];
  let orderByCalls = 0;
  const updates: unknown[] = [];

  return {
    get orderByCalls() {
      return orderByCalls;
    },
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
                  async function limit() {
                    return selectResults.shift() ?? [];
                  }

                  return {
                    limit,
                    orderBy() {
                      orderByCalls += 1;

                      return {
                        limit
                      };
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
                async where() {}
              };
            }
          };
        }
      } as never;
    }
  };
}
