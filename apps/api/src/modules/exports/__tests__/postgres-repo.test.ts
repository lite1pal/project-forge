import { describe, expect, it } from "vitest";

import { createPostgresExportJobRepo } from "../postgres-repo.js";

describe("createPostgresExportJobRepo", () => {
  it("creates and lists export jobs", async () => {
    const db = createFakeDb({
      insertResults: [
        {
          error: null,
          filters: { event: "user.created" },
          id: "export-1",
          objectKey: null,
          organizationId: "org-1",
          projectId: "project-1",
          requestedByUserId: "user-1",
          status: "pending"
        }
      ],
      selectResults: [
        [
          {
            error: null,
            filters: {},
            id: "export-lookup",
            objectKey: null,
            organizationId: "org-1",
            projectId: "project-1",
            requestedByUserId: "user-1",
            status: "pending"
          }
        ],
        [
          {
            error: "failed",
            filters: {},
            id: "export-2",
            objectKey: "exports/export-2.csv",
            organizationId: "org-1",
            projectId: "project-1",
            requestedByUserId: "user-1",
            status: "completed"
          }
        ]
      ]
    });
    const repo = createPostgresExportJobRepo(db.asDatabase());

    await expect(
      repo.create({
        filters: { event: "user.created" },
        organizationId: "org-1",
        projectId: "project-1",
        requestedByUserId: "user-1"
      })
    ).resolves.toEqual({
      error: undefined,
      filters: { event: "user.created" },
      id: "export-1",
      objectKey: undefined,
      organizationId: "org-1",
      projectId: "project-1",
      requestedByUserId: "user-1",
      status: "pending"
    });
    await expect(
      repo.findById({
        exportId: "export-lookup",
        organizationId: "org-1",
        projectId: "project-1"
      })
    ).resolves.toMatchObject({
      id: "export-lookup"
    });
    await expect(
      repo.listByProject({ organizationId: "org-1", projectId: "project-1" })
    ).resolves.toEqual([
      {
        error: "failed",
        filters: {},
        id: "export-2",
        objectKey: "exports/export-2.csv",
        organizationId: "org-1",
        projectId: "project-1",
        requestedByUserId: "user-1",
        status: "completed"
      }
    ]);
    await repo.markRunning("export-1");
    await repo.markCompleted({
      exportId: "export-1",
      objectKey: "exports/export-1.csv"
    });
    await repo.markFailed({
      error: "boom",
      exportId: "export-2"
    });
    await expect(repo.takePending(10)).resolves.toEqual([]);
    expect(db.updates).toHaveLength(3);
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
                  return {
                    async limit() {
                      return selectResults.shift() ?? [];
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
                async where() {}
              };
            }
          };
        }
      } as never;
    }
  };
}
