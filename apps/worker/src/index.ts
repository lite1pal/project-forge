import { loadRuntimeConfig } from "./config.js";
import { loadEnvFiles } from "./env-files.js";
import { createJobHandlerRegistry } from "./handlers.js";
import { createWorker, registerWorkerSignalHandlers } from "./worker.js";

const config = loadRuntimeConfig(loadEnvFiles());
const worker = createWorker({
  config,
  handlers: createJobHandlerRegistry()
});

registerWorkerSignalHandlers({
  worker
});

try {
  await worker.start();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
