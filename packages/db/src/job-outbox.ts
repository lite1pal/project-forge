import { jobOutbox } from "./schema/jobs.js";
import {
  jobNameSchema,
  jobPayloadSchema,
  jobStatusSchema,
  type JobName,
  type JobPayload,
  type JobStatus
} from "@auditrail/domain";
import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "./client.js";

export interface JobOutboxRecord {
  id: string;
  name: JobName;
  payload: JobPayload;
  status: JobStatus;
  availableAt: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface EnqueueJobInput {
  name: JobName;
  payload: JobPayload;
  availableAt?: string;
  maxAttempts?: number;
}

export interface ClaimNextJobOptions {
  name?: JobName;
  now?: string;
}

export interface MarkJobCompletedInput {
  id: string;
  processedAt?: string;
}

export interface MarkJobFailedInput {
  id: string;
  error: string;
  failedAt?: string;
  retryAt?: string;
}

export interface ListPendingJobsOptions {
  name?: JobName;
  limit?: number;
}

export interface CountPendingJobsOptions {
  name?: JobName;
}

export interface JobOutboxRepo {
  enqueue(input: EnqueueJobInput): Promise<JobOutboxRecord>;
  claimNext(options?: ClaimNextJobOptions): Promise<JobOutboxRecord | undefined>;
  markCompleted(
    input: MarkJobCompletedInput
  ): Promise<JobOutboxRecord | undefined>;
  markFailed(input: MarkJobFailedInput): Promise<JobOutboxRecord | undefined>;
  listPending(options?: ListPendingJobsOptions): Promise<JobOutboxRecord[]>;
  countPending(options?: CountPendingJobsOptions): Promise<number>;
}

const defaultMaxAttempts = 10;
const pendingStatus = "pending";
const processingStatus = "processing";
const completedStatus = "completed";
const failedStatus = "failed";

type JobOutboxRow = typeof jobOutbox.$inferSelect;

export function createPostgresJobOutboxRepo(
  db: Database,
  options: {
    now?: () => Date;
  } = {}
): JobOutboxRepo {
  const now = options.now ?? (() => new Date());

  return {
    async enqueue(input) {
      const currentTime = now();
      const [record] = await db
        .insert(jobOutbox)
        .values({
          availableAt: input.availableAt ? new Date(input.availableAt) : currentTime,
          maxAttempts: input.maxAttempts ?? defaultMaxAttempts,
          name: input.name,
          payload: input.payload,
          updatedAt: currentTime
        })
        .returning();

      return toJobOutboxRecord(record);
    },
    async claimNext(options = {}) {
      const claimedAt = options.now ? new Date(options.now) : now();
      const nameFilter = options.name
        ? sql`and "name" = ${options.name}`
        : sql``;
      const result = await db.execute(sql<JobOutboxRow>`
        with next_job as (
          select "id"
          from "job_outbox"
          where "status" = ${pendingStatus}
            and "available_at" <= ${claimedAt}
            ${nameFilter}
          order by "available_at" asc, "created_at" asc, "id" asc
          for update skip locked
          limit 1
        )
        update "job_outbox" as "job"
        set
          "status" = ${processingStatus},
          "attempt_count" = "job"."attempt_count" + 1,
          "updated_at" = ${claimedAt}
        from next_job
        where "job"."id" = next_job."id"
        returning
          "job"."id" as "id",
          "job"."name" as "name",
          "job"."payload" as "payload",
          "job"."status" as "status",
          "job"."available_at" as "availableAt",
          "job"."attempt_count" as "attemptCount",
          "job"."max_attempts" as "maxAttempts",
          "job"."last_error" as "lastError",
          "job"."created_at" as "createdAt",
          "job"."updated_at" as "updatedAt",
          "job"."processed_at" as "processedAt"
      `);
      const [record] = result.rows as JobOutboxRow[];

      return record ? toJobOutboxRecord(record) : undefined;
    },
    async markCompleted(input) {
      const processedAt = input.processedAt ? new Date(input.processedAt) : now();
      const [record] = await db
        .update(jobOutbox)
        .set({
          processedAt,
          status: completedStatus,
          updatedAt: processedAt
        })
        .where(
          and(
            eq(jobOutbox.id, input.id),
            eq(jobOutbox.status, processingStatus)
          )
        )
        .returning();

      return record ? toJobOutboxRecord(record) : undefined;
    },
    async markFailed(input) {
      const failedAt = input.failedAt ? new Date(input.failedAt) : now();
      const retryAt = input.retryAt ? new Date(input.retryAt) : undefined;
      const [record] = await db
        .select()
        .from(jobOutbox)
        .where(
          and(eq(jobOutbox.id, input.id), eq(jobOutbox.status, processingStatus))
        )
        .limit(1);

      if (!record) {
        return undefined;
      }

      const shouldRetry =
        retryAt !== undefined && record.attemptCount < record.maxAttempts;
      const [updatedRecord] = await db
        .update(jobOutbox)
        .set({
          availableAt: shouldRetry ? retryAt : record.availableAt,
          lastError: input.error,
          processedAt: shouldRetry ? null : failedAt,
          status: shouldRetry ? pendingStatus : failedStatus,
          updatedAt: failedAt
        })
        .where(
          and(eq(jobOutbox.id, input.id), eq(jobOutbox.status, processingStatus))
        )
        .returning();

      return updatedRecord ? toJobOutboxRecord(updatedRecord) : undefined;
    },
    async listPending(options: ListPendingJobsOptions = {}) {
      const query = db
        .select()
        .from(jobOutbox)
        .where(
          and(
            eq(jobOutbox.status, pendingStatus),
            options.name ? eq(jobOutbox.name, options.name) : undefined
          )
        )
        .orderBy(
          asc(jobOutbox.availableAt),
          asc(jobOutbox.createdAt),
          asc(jobOutbox.id)
        );
      const records =
        options.limit !== undefined ? await query.limit(options.limit) : await query;

      return records.map(toJobOutboxRecord);
    },
    async countPending(options: CountPendingJobsOptions = {}) {
      const countExpression = sql<number>`cast(count(*) as int)`;
      const [row] = await db
        .select({
          count: countExpression
        })
        .from(jobOutbox)
        .where(
          and(
            eq(jobOutbox.status, pendingStatus),
            options.name ? eq(jobOutbox.name, options.name) : undefined
          )
        );

      return row?.count ?? 0;
    }
  };
}

function toJobOutboxRecord(record: JobOutboxRow): JobOutboxRecord {
  return {
    attemptCount: record.attemptCount,
    availableAt: toIsoString(record.availableAt),
    createdAt: toIsoString(record.createdAt),
    id: record.id,
    lastError: record.lastError ?? undefined,
    maxAttempts: record.maxAttempts,
    name: jobNameSchema.parse(record.name),
    payload: jobPayloadSchema.parse(record.payload),
    processedAt: record.processedAt ? toIsoString(record.processedAt) : undefined,
    status: jobStatusSchema.parse(record.status),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
