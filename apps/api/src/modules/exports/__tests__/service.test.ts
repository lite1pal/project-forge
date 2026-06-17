import { describe, expect, it } from "vitest";

import {
  createExportService,
  type ExportJob,
  type ExportJobRepo
} from "../service.js";

describe("createExportService", () => {
  it("creates pending export jobs with validated filters", async () => {
    const service = createExportService(createInMemoryExportRepo());

    const job = await service.createExport({
      filters: {
        event: "user.created",
        from: "2026-01-01T00:00:00.000Z"
      },
      organizationId: "org-1",
      projectId: "project-1",
      requestedByUserId: "user-1"
    });

    expect(job.status).toBe("pending");
    expect(job.filters.event).toBe("user.created");
  });

  it("lists export jobs for the selected project", async () => {
    const service = createExportService(createInMemoryExportRepo());
    await service.createExport({
      filters: {},
      organizationId: "org-1",
      projectId: "project-1",
      requestedByUserId: "user-1"
    });
    await service.createExport({
      filters: {},
      organizationId: "org-1",
      projectId: "project-2",
      requestedByUserId: "user-1"
    });

    const jobs = await service.listExports({
      organizationId: "org-1",
      projectId: "project-1"
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.projectId).toBe("project-1");
  });

  it("gets export jobs by id", async () => {
    const service = createExportService(createInMemoryExportRepo());
    const job = await service.createExport({
      filters: {},
      organizationId: "org-1",
      projectId: "project-1",
      requestedByUserId: "user-1"
    });

    await expect(
      service.getExport({
        exportId: job.id,
        organizationId: "org-1",
        projectId: "project-1"
      })
    ).resolves.toEqual(job);
  });
});

function createInMemoryExportRepo(): ExportJobRepo {
  const jobs: ExportJob[] = [];

  return {
    async create(input) {
      const job = {
        ...input,
        id: `export-${jobs.length + 1}`,
        status: "pending" as const
      };
      jobs.push(job);
      return job;
    },
    async findById(input) {
      return jobs.find(
        (job) =>
          job.id === input.exportId &&
          job.organizationId === input.organizationId &&
          job.projectId === input.projectId
      );
    },
    async listByProject(input) {
      return jobs.filter(
        (job) =>
          job.organizationId === input.organizationId &&
          job.projectId === input.projectId
      );
    },
    async markCompleted() {},
    async markFailed() {},
    async markRunning() {},
    async takePending() {
      return [];
    }
  };
}
