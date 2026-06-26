import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import * as schema from "@auditrail/db/schema";

import { loadEnvFiles } from "../../../env-files.js";
import { createPostgresJobOutboxRepo } from "../postgres-repo.js";
import type { AppDatabase } from "../../../plugins/database.js";

const integrationEnv = z
  .object({
    TEST_DATABASE_URL: z.string().url()
  })
  .parse(loadEnvFiles());
const databaseUrl = integrationEnv.TEST_DATABASE_URL;

describe("createPostgresJobOutboxRepo integration", () => {
  const currentTime = new Date("2026-06-26T10:00:00.000Z");
  const pool = new pg.Pool({
    connectionString: databaseUrl
  });
  const db = drizzle(pool, {
    schema
  }) as AppDatabase;
  const repo = createPostgresJobOutboxRepo(db, {
    now: () => currentTime
  });

  beforeEach(async () => {
    try {
      await pool.query('TRUNCATE TABLE "job_outbox" RESTART IDENTITY CASCADE');
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "3D000"
      ) {
        throw new Error(
          "TEST_DATABASE_URL database does not exist. Run `pnpm db:create:test && pnpm db:migrate:test` first."
        );
      }

      throw error;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("enqueues jobs and lists pending records", async () => {
    const enqueued = await repo.enqueue({
      name: "email.delivery.requested",
      payload: {
        attempt: 1,
        recipient: "user@example.com"
      }
    });

    expect(enqueued).toMatchObject({
      attemptCount: 0,
      lastError: undefined,
      maxAttempts: 10,
      name: "email.delivery.requested",
      payload: {
        attempt: 1,
        recipient: "user@example.com"
      },
      processedAt: undefined,
      status: "pending"
    });
    await expect(repo.countPending()).resolves.toBe(1);
    await expect(repo.listPending()).resolves.toEqual([enqueued]);
  });

  it("claims the next available pending job by availability order", async () => {
    await repo.enqueue({
      availableAt: "2026-06-26T10:05:00.000Z",
      name: "billing.webhook.received",
      payload: {
        source: "stripe"
      }
    });
    const firstJob = await repo.enqueue({
      availableAt: "2026-06-26T10:00:00.000Z",
      name: "email.delivery.requested",
      payload: {
        recipient: "first@example.com"
      }
    });

    const claimed = await repo.claimNext({
      now: "2026-06-26T10:10:00.000Z"
    });

    expect(claimed).toMatchObject({
      attemptCount: 1,
      id: firstJob.id,
      name: "email.delivery.requested",
      status: "processing"
    });
    await expect(repo.countPending()).resolves.toBe(1);
  });

  it("does not claim jobs that are not available yet", async () => {
    await repo.enqueue({
      availableAt: "2026-06-26T12:00:00.000Z",
      name: "audit-event.created",
      payload: {
        eventId: "evt_123"
      }
    });

    await expect(
      repo.claimNext({
        now: "2026-06-26T11:59:59.000Z"
      })
    ).resolves.toBeUndefined();
    await expect(repo.countPending()).resolves.toBe(1);
  });

  it("marks a claimed job as completed", async () => {
    const enqueued = await repo.enqueue({
      name: "billing.webhook.received",
      payload: {
        source: "stripe"
      }
    });
    await repo.claimNext({
      now: "2026-06-26T10:00:00.000Z"
    });

    const completed = await repo.markCompleted({
      id: enqueued.id,
      processedAt: "2026-06-26T10:01:00.000Z"
    });

    expect(completed).toMatchObject({
      id: enqueued.id,
      processedAt: "2026-06-26T10:01:00.000Z",
      status: "completed"
    });
    await expect(repo.countPending()).resolves.toBe(0);
    await expect(selectJob(enqueued.id)).resolves.toMatchObject({
      processed_at: "2026-06-26T10:01:00.000Z",
      status: "completed"
    });
  });

  it("marks failed jobs as retryable when attempts remain", async () => {
    const enqueued = await repo.enqueue({
      maxAttempts: 3,
      name: "email.delivery.requested",
      payload: {
        recipient: "user@example.com"
      }
    });
    await repo.claimNext({
      now: "2026-06-26T10:00:00.000Z"
    });

    const failed = await repo.markFailed({
      error: "smtp_unavailable",
      id: enqueued.id,
      retryAt: "2026-06-26T10:05:00.000Z"
    });

    expect(failed).toMatchObject({
      attemptCount: 1,
      id: enqueued.id,
      lastError: "smtp_unavailable",
      processedAt: undefined,
      status: "pending"
    });
    await expect(
      repo.claimNext({
        now: "2026-06-26T10:04:59.000Z"
      })
    ).resolves.toBeUndefined();
    await expect(
      repo.claimNext({
        now: "2026-06-26T10:05:00.000Z"
      })
    ).resolves.toMatchObject({
      attemptCount: 2,
      id: enqueued.id,
      status: "processing"
    });
  });

  it("marks jobs as failed when max attempts are exhausted", async () => {
    const enqueued = await repo.enqueue({
      maxAttempts: 1,
      name: "email.delivery.requested",
      payload: {
        recipient: "user@example.com"
      }
    });
    await repo.claimNext({
      now: "2026-06-26T10:00:00.000Z"
    });

    const failed = await repo.markFailed({
      error: "smtp_unavailable",
      id: enqueued.id,
      retryAt: "2026-06-26T10:05:00.000Z"
    });

    expect(failed).toMatchObject({
      attemptCount: 1,
      id: enqueued.id,
      lastError: "smtp_unavailable",
      status: "failed"
    });
    expect(failed?.processedAt).toBeDefined();
    await expect(repo.countPending()).resolves.toBe(0);
  });

  it("claims a job only once under concurrent access", async () => {
    const enqueued = await repo.enqueue({
      name: "audit-event.created",
      payload: {
        eventId: "evt_123"
      }
    });

    const [firstClaim, secondClaim] = await Promise.all([
      repo.claimNext({
        now: "2026-06-26T10:00:00.000Z"
      }),
      repo.claimNext({
        now: "2026-06-26T10:00:00.000Z"
      })
    ]);
    const claimedJobs = [firstClaim, secondClaim].filter(
      (job): job is NonNullable<typeof job> => job !== undefined
    );

    expect(claimedJobs).toHaveLength(1);
    expect(claimedJobs[0]).toMatchObject({
      attemptCount: 1,
      id: enqueued.id,
      status: "processing"
    });
  });

  async function selectJob(id: string) {
    const result = await pool.query<{
      processed_at: string | null;
      status: string;
    }>(
      `select to_char("processed_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "processed_at", "status"
       from "job_outbox"
       where "id" = $1`,
      [id]
    );

    return result.rows[0];
  }
});
