import { loadEnvFiles } from "../apps/api/src/env-files.js";
import { createPostgresPlatformRepo } from "../apps/api/src/modules/platform/postgres-repo.js";
import { createPlatformService } from "../apps/api/src/modules/platform/service.js";
import { createDatabaseClient } from "../packages/db/src/client.js";
import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url()
});

async function main() {
  const productIds = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);

  if (productIds.length === 0) {
    throw new Error(
      "Missing product ids. Usage: pnpm products:backfill <product-id> [product-id ...]"
    );
  }

  const env = databaseEnvSchema.parse(loadEnvFiles());
  const database = createDatabaseClient(env.DATABASE_URL);

  try {
    const service = createPlatformService(createPostgresPlatformRepo(database.db));
    const result = await service.backfillInstalledProducts({
      productIds
    });

    console.log(
      [
        "Backfilled installed products.",
        `- products: ${result.productIds.join(", ")}`,
        `- organizations scanned: ${result.organizationCount}`,
        `- installations changed: ${result.changedInstallations}`,
        `- installations unchanged: ${result.unchangedInstallations}`
      ].join("\n")
    );
  } finally {
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
