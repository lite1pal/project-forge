import { eq } from "drizzle-orm";

import { apiKeys, organizations, projects } from "./schema/index.js";
import { createDatabase } from "./client.js";

export interface SeedInput {
  databaseUrl: string;
  keyHash: string;
  keyPrefix: string;
}

export interface SeedDemoProjectResult {
  organizationId: string;
  projectId: string;
  apiKeyName: string;
}

export async function seedDemoProject(
  input: SeedInput
): Promise<SeedDemoProjectResult> {
  const db = createDatabase(input.databaseUrl);
  const [existingApiKey] = await db
    .select({
      organizationId: projects.organizationId,
      projectId: apiKeys.projectId,
      apiKeyName: apiKeys.name
    })
    .from(apiKeys)
    .innerJoin(projects, eq(projects.id, apiKeys.projectId))
    .where(eq(apiKeys.keyHash, input.keyHash))
    .limit(1);

  if (existingApiKey) {
    return existingApiKey;
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

  await db.insert(apiKeys).values({
    projectId: project.id,
    keyHash: input.keyHash,
    keyPrefix: input.keyPrefix,
    name: "Local development key"
  });

  return {
    organizationId: organization.id,
    projectId: project.id,
    apiKeyName: "Local development key"
  };
}
