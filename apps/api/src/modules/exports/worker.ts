import type { AuditEventRepo } from "../audit-events/repo.js";
import type { ExportJobRepo } from "./service.js";
import { toAuditEventsCsv } from "./csv.js";
import type { ExportObjectStorage } from "./storage.js";

export interface ExportWorkerOptions {
  batchSize?: number;
  listLimit?: number;
}

export async function processPendingExports(input: {
  auditEvents: AuditEventRepo;
  exports: ExportJobRepo;
  storage: ExportObjectStorage;
  options?: ExportWorkerOptions;
}) {
  const batchSize = input.options?.batchSize ?? 10;
  const listLimit = input.options?.listLimit ?? 10_000;
  const jobs = await input.exports.takePending(batchSize);

  for (const job of jobs) {
    await input.exports.markRunning(job.id);

    try {
      const events = await input.auditEvents.list(
        {
          organizationId: job.organizationId,
          projectId: job.projectId
        },
        {
          actorIds: job.filters.actor ? [job.filters.actor] : undefined,
          eventTypes: job.filters.event ? [job.filters.event] : undefined,
          from: job.filters.from,
          limit: listLimit,
          targetIds: job.filters.target ? [job.filters.target] : undefined,
          to: job.filters.to
        }
      );
      const objectKey = `exports/${job.organizationId}/${job.projectId}/${job.id}.csv`;

      await input.storage.putObject({
        body: toAuditEventsCsv(events),
        contentType: "text/csv",
        key: objectKey
      });
      await input.exports.markCompleted({
        exportId: job.id,
        objectKey
      });
    } catch (error) {
      await input.exports.markFailed({
        error: error instanceof Error ? error.message : "export_failed",
        exportId: job.id
      });
    }
  }

  return {
    processed: jobs.length
  };
}
