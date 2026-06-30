import {
  createDatabaseClient,
  createPostgresJobOutboxRepo
} from "@auditrail/db";

import { createDefaultJobHandlers } from "./default-handlers.js";
import { loadRuntimeConfig } from "./config.js";
import { loadEnvFiles } from "./env-files.js";
import { createJobHandlerRegistry } from "./handlers.js";
import { createJobOutboxWorkerLifecycle } from "./outbox-runtime.js";
import { createWorker, registerWorkerSignalHandlers } from "./worker.js";

const config = loadRuntimeConfig(loadEnvFiles());
const database = createDatabaseClient(config.DATABASE_URL);
const handlers = createJobHandlerRegistry(
  createDefaultJobHandlers({
    db: database.db,
    retryDelayMs: config.WORKER_RETRY_DELAY_MS
  })
);
const outboxLifecycle = createJobOutboxWorkerLifecycle({
  config,
  handlers,
  repo: createPostgresJobOutboxRepo(database.db)
});
const worker = createWorker({
  config,
  handlers,
  lifecycle: {
    onStart() {
      return outboxLifecycle.onStart?.();
    },
    async onStop() {
      try {
        await outboxLifecycle.onStop?.();
      } finally {
        await database.pool.end();
      }
    }
  }
});

registerWorkerSignalHandlers({
  worker
});

try {
  await worker.start();
} catch (error) {
  await database.pool.end();
  console.error(error);
  process.exitCode = 1;
}
