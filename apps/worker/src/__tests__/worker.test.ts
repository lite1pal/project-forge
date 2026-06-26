import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { createJobHandlerRegistry } from "../handlers.js";
import { createWorker, registerWorkerSignalHandlers } from "../worker.js";
import type { WorkerLogger } from "../worker.js";

describe("createWorker", () => {
  it("starts and stops cleanly with lifecycle hooks", async () => {
    const logEntries: Array<{
      details?: Record<string, unknown>;
      message: string;
    }> = [];
    const keepAlive = {
      clear: vi.fn()
    };
    const worker = createWorker({
      config: {
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        NODE_ENV: "test",
        WORKER_LOG_LEVEL: "info",
        WORKER_NAME: "worker-test",
        WORKER_SHUTDOWN_TIMEOUT_MS: 5000
      },
      handlers: createJobHandlerRegistry(),
      lifecycle: {
        onStart: vi.fn(),
        onStop: vi.fn()
      },
      logger: createLogger(logEntries),
      scheduleKeepAlive: () => keepAlive
    });

    expect(worker.isRunning()).toBe(false);

    await worker.start();

    expect(worker.isRunning()).toBe(true);
    expect(logEntries).toContainEqual({
      details: {
        handlerCount: 0,
        shutdownTimeoutMs: 5000,
        workerName: "worker-test"
      },
      message: "worker_started"
    });

    await worker.stop({
      reason: "test_complete"
    });

    expect(worker.isRunning()).toBe(false);
    expect(keepAlive.clear).toHaveBeenCalledTimes(1);
    expect(logEntries).toContainEqual({
      details: {
        reason: "test_complete",
        workerName: "worker-test"
      },
      message: "worker_stopped"
    });
  });

  it("handles SIGTERM and unregisters signal listeners", async () => {
    const signalSource = new EventEmitter();
    const exitCodes: number[] = [];
    const logEntries: Array<{
      details?: Record<string, unknown>;
      message: string;
    }> = [];
    const worker = createWorker({
      config: {
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        NODE_ENV: "test",
        WORKER_LOG_LEVEL: "info",
        WORKER_NAME: "worker-test",
        WORKER_SHUTDOWN_TIMEOUT_MS: 5000
      },
      handlers: createJobHandlerRegistry(),
      logger: createLogger(logEntries),
      scheduleKeepAlive: () => ({
        clear: vi.fn()
      })
    });
    const cleanup = registerWorkerSignalHandlers({
      logger: createLogger(logEntries),
      setExitCode(code) {
        exitCodes.push(code);
      },
      signalSource: signalSource as never,
      worker
    });

    await worker.start();
    signalSource.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));

    expect(worker.isRunning()).toBe(false);
    expect(exitCodes).toEqual([0]);
    expect(logEntries).toContainEqual({
      details: {
        signal: "SIGTERM"
      },
      message: "worker_shutdown_signal"
    });

    cleanup();
    expect(signalSource.listenerCount("SIGTERM")).toBe(0);
    expect(signalSource.listenerCount("SIGINT")).toBe(0);
  });

  it("fails shutdown when cleanup exceeds the configured timeout", async () => {
    const worker = createWorker({
      config: {
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        NODE_ENV: "test",
        WORKER_LOG_LEVEL: "info",
        WORKER_NAME: "worker-test",
        WORKER_SHUTDOWN_TIMEOUT_MS: 10
      },
      handlers: createJobHandlerRegistry(),
      lifecycle: {
        async onStop() {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      },
      scheduleKeepAlive: () => ({
        clear: vi.fn()
      })
    });

    await worker.start();

    await expect(worker.stop()).rejects.toThrow("worker_shutdown_timeout");
    expect(worker.isRunning()).toBe(false);
  });
});

function createLogger(
  entries: Array<{
    details?: Record<string, unknown>;
    message: string;
  }>
): WorkerLogger {
  return {
    error(message, details) {
      entries.push({
        details,
        message
      });
    },
    info(message, details) {
      entries.push({
        details,
        message
      });
    },
    warn(message, details) {
      entries.push({
        details,
        message
      });
    }
  };
}
