import { createDatabase } from "@auditrail/db";
import fp from "fastify-plugin";

import { loadConfig } from "../config.js";
import { loadEnvFiles } from "../env-files.js";

export type AppDatabase = ReturnType<typeof createDatabase>;

export interface DatabasePluginOptions {
  databaseUrl?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    db: AppDatabase;
  }
}

export const databasePlugin = fp<DatabasePluginOptions>(async (app, options) => {
  const config = loadConfig(loadEnvFiles());
  const databaseUrl = options.databaseUrl ?? config.DATABASE_URL;

  app.decorate("db", createDatabase(databaseUrl));
});
