import pg from "pg";
import { z } from "zod";

import { loadEnvFiles } from "../apps/api/src/env-files.js";

const env = z
  .object({
    TEST_DATABASE_URL: z.string().url()
  })
  .parse(loadEnvFiles(process.cwd(), [".env"]));

async function main() {
  const databaseUrl = new URL(env.TEST_DATABASE_URL);
  const databaseName = databaseUrl.pathname.replace(/^\//, "");

  if (!databaseName) {
    throw new Error("TEST_DATABASE_URL must include a database name");
  }

  const adminUrl = new URL(env.TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const pool = new pg.Pool({
    connectionString: adminUrl.toString()
  });

  try {
    const existingDatabase = await pool.query(
      "select 1 from pg_database where datname = $1",
      [databaseName]
    );

    if (existingDatabase.rowCount === 0) {
      const escapedDatabaseName = databaseName.replace(/"/g, "\"\"");

      await pool.query(`create database "${escapedDatabaseName}"`);
      console.log(`Created test database ${databaseName}`);
    } else {
      console.log(`Test database ${databaseName} already exists`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
