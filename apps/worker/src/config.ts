import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  WORKER_NAME: z.string().trim().min(1).default("auditrail-worker"),
  WORKER_LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(5000)
});

export type WorkerConfig = z.infer<typeof environmentSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return environmentSchema.parse(env);
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): WorkerConfig {
  return loadConfig(env);
}
