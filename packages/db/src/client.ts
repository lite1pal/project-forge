import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseClient {
  db: Database;
  pool: pg.Pool;
}

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  const pool = new pg.Pool({
    connectionString: databaseUrl
  });

  return {
    db: drizzle(pool, {
      schema
    }),
    pool
  };
}

export function createDatabase(databaseUrl: string) {
  return createDatabaseClient(databaseUrl).db;
}
