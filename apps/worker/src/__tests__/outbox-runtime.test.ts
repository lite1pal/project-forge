import { describe, expect, it, vi } from "vitest";

import { createJobHandlerRegistry } from "../handlers.js";
import { createJobOutboxWorkerLifecycle } from "../outbox-runtime.js";

describe("createJobOutboxWorkerLifecycle", () => {
  it("claims, handles, and completes jobs", async () => {
    const repo = {
      claimNext: vi
        .fn()
        .mockResolvedValueOnce({
          attemptCount: 1,
          availableAt: "2026-06-30T12:00:00.000Z",
          createdAt: "2026-06-30T12:00:00.000Z",
          id: "job-1",
          maxAttempts: 10,
          name: "audit-event.created",
          payload: {
            eventId: "evt_1",
            organizationId: "org_1",
            projectId: "proj_1"
          },
          status: "processing",
          updatedAt: "2026-06-30T12:00:00.000Z"
        })
        .mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return undefined;
        }),
      markCompleted: vi.fn().mockResolvedValue({
        id: "job-1",
        status: "completed"
      }),
      markFailed: vi.fn(),
      countPending: vi.fn(),
      enqueue: vi.fn(),
      listPending: vi.fn()
    };
    const handle = vi.fn();
    const lifecycle = createJobOutboxWorkerLifecycle({
      config: {
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        NODE_ENV: "test",
        WORKER_LOG_LEVEL: "info",
        WORKER_NAME: "worker-test",
        WORKER_POLL_INTERVAL_MS: 1,
        WORKER_RETRY_DELAY_MS: 1000,
        WORKER_SHUTDOWN_TIMEOUT_MS: 5000
      },
      handlers: createJobHandlerRegistry([
        {
          handle,
          name: "audit-event.created"
        }
      ]),
      repo
    });

    lifecycle.onStart?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await lifecycle.onStop?.();

    expect(handle).toHaveBeenCalledWith({
      id: "job-1",
      name: "audit-event.created",
      payload: {
        eventId: "evt_1",
        organizationId: "org_1",
        projectId: "proj_1"
      }
    });
    expect(repo.markCompleted).toHaveBeenCalledWith({
      id: "job-1",
      processedAt: expect.any(String)
    });
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("requeues failed jobs with a retry delay when a handler throws", async () => {
    const repo = {
      claimNext: vi
        .fn()
        .mockResolvedValueOnce({
          attemptCount: 1,
          availableAt: "2026-06-30T12:00:00.000Z",
          createdAt: "2026-06-30T12:00:00.000Z",
          id: "job-2",
          maxAttempts: 10,
          name: "audit-event.created",
          payload: {
            eventId: "evt_2"
          },
          status: "processing",
          updatedAt: "2026-06-30T12:00:00.000Z"
        })
        .mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return undefined;
        }),
      markCompleted: vi.fn(),
      markFailed: vi.fn().mockResolvedValue({
        id: "job-2",
        status: "pending"
      }),
      countPending: vi.fn(),
      enqueue: vi.fn(),
      listPending: vi.fn()
    };
    const lifecycle = createJobOutboxWorkerLifecycle({
      config: {
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        NODE_ENV: "test",
        WORKER_LOG_LEVEL: "info",
        WORKER_NAME: "worker-test",
        WORKER_POLL_INTERVAL_MS: 1,
        WORKER_RETRY_DELAY_MS: 30000,
        WORKER_SHUTDOWN_TIMEOUT_MS: 5000
      },
      handlers: createJobHandlerRegistry([
        {
          async handle() {
            throw new Error("smtp_unavailable");
          },
          name: "audit-event.created"
        }
      ]),
      now: () => new Date("2026-06-30T12:00:00.000Z"),
      repo
    });

    lifecycle.onStart?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await lifecycle.onStop?.();

    expect(repo.markCompleted).not.toHaveBeenCalled();
    expect(repo.markFailed).toHaveBeenCalledWith({
      error: "smtp_unavailable",
      failedAt: "2026-06-30T12:00:00.000Z",
      id: "job-2",
      retryAt: "2026-06-30T12:00:30.000Z"
    });
  });

  it("marks jobs as failed when no handler is registered", async () => {
    const repo = {
      claimNext: vi
        .fn()
        .mockResolvedValueOnce({
          attemptCount: 1,
          availableAt: "2026-06-30T12:00:00.000Z",
          createdAt: "2026-06-30T12:00:00.000Z",
          id: "job-3",
          maxAttempts: 10,
          name: "billing.webhook.received",
          payload: {
            source: "stripe"
          },
          status: "processing",
          updatedAt: "2026-06-30T12:00:00.000Z"
        })
        .mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return undefined;
        }),
      markCompleted: vi.fn(),
      markFailed: vi.fn().mockResolvedValue({
        id: "job-3",
        status: "failed"
      }),
      countPending: vi.fn(),
      enqueue: vi.fn(),
      listPending: vi.fn()
    };
    const lifecycle = createJobOutboxWorkerLifecycle({
      config: {
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        NODE_ENV: "test",
        WORKER_LOG_LEVEL: "info",
        WORKER_NAME: "worker-test",
        WORKER_POLL_INTERVAL_MS: 1,
        WORKER_RETRY_DELAY_MS: 30000,
        WORKER_SHUTDOWN_TIMEOUT_MS: 5000
      },
      handlers: createJobHandlerRegistry(),
      now: () => new Date("2026-06-30T12:00:00.000Z"),
      repo
    });

    lifecycle.onStart?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await lifecycle.onStop?.();

    expect(repo.markCompleted).not.toHaveBeenCalled();
    expect(repo.markFailed).toHaveBeenCalledWith({
      error: "missing_job_handler:billing.webhook.received",
      failedAt: "2026-06-30T12:00:00.000Z",
      id: "job-3"
    });
  });
});
