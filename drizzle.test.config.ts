import { defineConfig } from "drizzle-kit";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for drizzle.test.config.ts");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/src/schema/index.ts",
  out: "./packages/db/src/migrations",
  dbCredentials: {
    url: testDatabaseUrl
  }
});
