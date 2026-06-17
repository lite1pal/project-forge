import { describe, expect, it } from "vitest";

import type { AuditEventRepo } from "../../audit-events/repo.js";
import type { ExportJobRepo } from "../service.js";
import { createInMemoryExportObjectStorage } from "../storage.js";
import { processPendingExports } from "../worker.js";

describe("processPendingExports", () => {
  it("writes CSV files for pending export jobs", async () => {
    const storage = createInMemoryExportObjectStorage();
    const exports = createExportRepoStub();

    const result = await processPendingExports({
      auditEvents: createAuditEventRepoStub(),
      exports,
      storage
    });

    expect(result.processed).toBe(1);
    expect(exports.completed).toEqual([
      {
        exportId: "export-1",
        objectKey: "exports/org-1/project-1/export-1.csv"
      }
    ]);
    expect(storage.objects.get("exports/org-1/project-1/export-1.csv")).toContain(
      "user.created"
    );
  });

  it("marks failed jobs when export generation fails", async () => {
    const exports = createExportRepoStub();

    await processPendingExports({
      auditEvents: {
        ...createAuditEventRepoStub(),
        async list() {
          throw new Error("boom");
        }
      },
      exports,
      storage: createInMemoryExportObjectStorage()
    });

    expect(exports.failed).toEqual([
      {
        error: "boom",
        exportId: "export-1"
      }
    ]);
  });
});

function createAuditEventRepoStub(): AuditEventRepo {
  return {
    async append() {
      throw new Error("not implemented");
    },
    async list() {
      return [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          eventType: "user.created",
          id: "event-1",
          metadata: { source: "test" }
        }
      ];
    },
    async summarize() {
      throw new Error("not implemented");
    },
    async timeseries() {
      throw new Error("not implemented");
    }
  };
}

function createExportRepoStub(): ExportJobRepo & {
  completed: Array<{ exportId: string; objectKey: string }>;
  failed: Array<{ error: string; exportId: string }>;
} {
  const completed: Array<{ exportId: string; objectKey: string }> = [];
  const failed: Array<{ error: string; exportId: string }> = [];

  return {
    completed,
    failed,
    async create() {
      throw new Error("not implemented");
    },
    async findById() {
      return undefined;
    },
    async listByProject() {
      return [];
    },
    async markCompleted(input) {
      completed.push(input);
    },
    async markFailed(input) {
      failed.push(input);
    },
    async markRunning() {},
    async takePending() {
      return [
        {
          filters: {},
          id: "export-1",
          organizationId: "org-1",
          projectId: "project-1",
          requestedByUserId: "user-1",
          status: "pending"
        }
      ];
    }
  };
}
