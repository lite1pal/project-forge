import type { JobOutboxRecord, JobOutboxRepo } from "@auditrail/db/job-outbox";

import type { WorkerConfig } from "./config.js";
import type { JobHandlerRegistry } from "./handlers.js";
import type { WorkerLifecycle, WorkerLogger } from "./worker.js";

export function createJobOutboxWorkerLifecycle(options: {
  config: WorkerConfig;
  handlers: JobHandlerRegistry;
  logger?: WorkerLogger;
  now?: () => Date;
  repo: JobOutboxRepo;
  sleep?: (ms: number) => Promise<void>;
}): WorkerLifecycle {
  const logger = options.logger ?? console;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;
  let stopping = false;
  let loopPromise: Promise<void> | undefined;
  let wakeUp: (() => void) | undefined;

  return {
    onStart() {
      stopping = false;
      if (!loopPromise) {
        loopPromise = runLoop();
      }
    },
    async onStop() {
      stopping = true;
      wakeUp?.();
      await loopPromise;
      loopPromise = undefined;
      wakeUp = undefined;
    }
  };

  async function runLoop() {
    while (!stopping) {
      let job: JobOutboxRecord | undefined;

      try {
        job = await options.repo.claimNext({
          now: now().toISOString()
        });
      } catch (error) {
        logger.error("worker_claim_failed", {
          error: toErrorMessage(error)
        });
        await waitForNextPoll();
        continue;
      }

      if (!job) {
        await waitForNextPoll();
        continue;
      }

      await processJob(job);
    }
  }

  async function processJob(job: JobOutboxRecord) {
    const handler = options.handlers.get(job.name);

    if (!handler) {
      await options.repo.markFailed({
        error: `missing_job_handler:${job.name}`,
        failedAt: now().toISOString(),
        id: job.id
      });
      logger.error("worker_job_missing_handler", {
        id: job.id,
        name: job.name
      });
      return;
    }

    logger.info("worker_job_claimed", {
      attemptCount: job.attemptCount,
      id: job.id,
      name: job.name
    });

    try {
      await handler({
        id: job.id,
        name: job.name,
        payload: job.payload
      });
      const completed = await options.repo.markCompleted({
        id: job.id,
        processedAt: now().toISOString()
      });

      if (!completed) {
        logger.warn("worker_job_complete_conflict", {
          id: job.id,
          name: job.name
        });
        return;
      }

      logger.info("worker_job_completed", {
        id: job.id,
        name: job.name
      });
    } catch (error) {
      const failedAt = now();
      const failure = await options.repo.markFailed({
        error: toErrorMessage(error),
        failedAt: failedAt.toISOString(),
        id: job.id,
        retryAt: new Date(
          failedAt.getTime() + options.config.WORKER_RETRY_DELAY_MS
        ).toISOString()
      });

      logger.error("worker_job_failed", {
        attemptCount: job.attemptCount,
        error: toErrorMessage(error),
        id: job.id,
        maxAttempts: job.maxAttempts,
        name: job.name,
        status: failure?.status ?? "unknown"
      });
    }
  }

  async function waitForNextPoll() {
    if (stopping) {
      return;
    }

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) {
          return;
        }

        done = true;
        wakeUp = undefined;
        resolve();
      };

      wakeUp = finish;
      void sleep(options.config.WORKER_POLL_INTERVAL_MS).then(finish);
    });
  }
}

async function defaultSleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}
