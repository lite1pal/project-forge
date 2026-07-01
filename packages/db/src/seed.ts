import { and, eq } from "drizzle-orm";
import { auditTrailProduct } from "@auditrail/domain/audit-events";

import {
  apiKeys,
  organizationInstalledProducts,
  organizations,
  projects
} from "./schema/index.js";
import { createDatabase } from "./client.js";

export interface SeedInput {
  databaseUrl: string;
  apiKey?: {
    keyHash: string;
    keyPrefix: string;
    name?: string;
  };
  installedProductIds?: readonly string[];
}

export interface SeedDemoProjectResult {
  organizationId: string;
  projectId: string;
  apiKeyName?: string;
}

export async function seedDemoProject(
  input: SeedInput
): Promise<SeedDemoProjectResult> {
  const db = createDatabase(input.databaseUrl);
  const installedProductIds = input.installedProductIds ?? [auditTrailProduct.id];
  const [existingProject] = await db
    .select({
      organizationId: organizations.id,
      projectId: projects.id
    })
    .from(organizations)
    .innerJoin(projects, eq(projects.organizationId, organizations.id))
    .where(
      and(
        eq(organizations.name, "AcmeCRM"),
        eq(projects.name, "AcmeCRM Production")
      )
    )
    .limit(1);

  if (existingProject) {
    await ensureInstalledProducts(
      db,
      existingProject.organizationId,
      installedProductIds
    );
    return ensureApiKey(db, existingProject, input.apiKey);
  }

  const [organization] = await db
    .insert(organizations)
    .values({
      name: "AcmeCRM"
    })
    .returning({
      id: organizations.id
    });

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: "AcmeCRM Production",
      environment: "production"
    })
    .returning({
      id: projects.id
    });

  await ensureInstalledProducts(db, organization.id, installedProductIds);

  return ensureApiKey(
    db,
    {
      organizationId: organization.id,
      projectId: project.id
    },
    input.apiKey
  );
}

async function ensureApiKey(
  db: ReturnType<typeof createDatabase>,
  project: {
    organizationId: string;
    projectId: string;
  },
  apiKey: SeedInput["apiKey"]
): Promise<SeedDemoProjectResult> {
  if (!apiKey) {
    return project;
  }

  const [existingApiKey] = await db
    .select({
      apiKeyName: apiKeys.name
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, apiKey.keyHash))
    .limit(1);

  if (existingApiKey) {
    return {
      ...project,
      apiKeyName: existingApiKey.apiKeyName
    };
  }

  const apiKeyName = apiKey.name ?? "Seeded API key";

  await db.insert(apiKeys).values({
    projectId: project.projectId,
    keyHash: apiKey.keyHash,
    keyPrefix: apiKey.keyPrefix,
    name: apiKeyName
  });

  return {
    ...project,
    apiKeyName
  };
}

async function ensureInstalledProducts(
  db: ReturnType<typeof createDatabase>,
  organizationId: string,
  installedProductIds: readonly string[]
) {
  for (const productId of installedProductIds) {
    const [existingProduct] = await db
      .select({
        id: organizationInstalledProducts.id
      })
      .from(organizationInstalledProducts)
      .where(
        and(
          eq(organizationInstalledProducts.organizationId, organizationId),
          eq(organizationInstalledProducts.productId, productId)
        )
      )
      .limit(1);

    if (existingProduct) {
      continue;
    }

    await db.insert(organizationInstalledProducts).values({
      enabled: true,
      organizationId,
      productId
    });
  }
}
