import { exportJobs } from "@auditrail/db/schema";
import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../../plugins/database.js";
import type { ExportJob, ExportJobRepo } from "./service.js";

export function createPostgresExportJobRepo(db: AppDatabase): ExportJobRepo {
  return {
    async create(input) {
      const [record] = await db
        .insert(exportJobs)
        .values({
          filters: input.filters,
          objectKey: input.objectKey,
          organizationId: input.organizationId,
          projectId: input.projectId,
          requestedByUserId: input.requestedByUserId
        })
        .returning();

      return toExportJob(record);
    },
    async findById(input) {
      const [record] = await db
        .select()
        .from(exportJobs)
        .where(
          and(
            eq(exportJobs.id, input.exportId),
            eq(exportJobs.organizationId, input.organizationId),
            eq(exportJobs.projectId, input.projectId)
          )
        )
        .limit(1);

      return record ? toExportJob(record) : undefined;
    },
    async listByProject(input) {
      const records = await db
        .select()
        .from(exportJobs)
        .where(
          and(
            eq(exportJobs.organizationId, input.organizationId),
            eq(exportJobs.projectId, input.projectId)
          )
        );

      return records.map(toExportJob);
    },
    async markCompleted(input) {
      await db
        .update(exportJobs)
        .set({
          completedAt: new Date(),
          objectKey: input.objectKey,
          status: "completed"
        })
        .where(eq(exportJobs.id, input.exportId));
    },
    async markFailed(input) {
      await db
        .update(exportJobs)
        .set({
          error: input.error,
          status: "failed"
        })
        .where(eq(exportJobs.id, input.exportId));
    },
    async markRunning(exportId) {
      await db
        .update(exportJobs)
        .set({
          status: "running"
        })
        .where(eq(exportJobs.id, exportId));
    },
    async takePending(limit) {
      const records = await db
        .select()
        .from(exportJobs)
        .where(eq(exportJobs.status, "pending"))
        .limit(limit);

      return records.map(toExportJob);
    }
  };
}

function toExportJob(record: typeof exportJobs.$inferSelect): ExportJob {
  return {
    error: record.error ?? undefined,
    filters: record.filters as ExportJob["filters"],
    id: record.id,
    objectKey: record.objectKey ?? undefined,
    organizationId: record.organizationId,
    projectId: record.projectId,
    requestedByUserId: record.requestedByUserId,
    status: record.status as ExportJob["status"]
  };
}
