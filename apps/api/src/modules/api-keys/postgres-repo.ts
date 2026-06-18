import { apiKeys, organizationMemberships, projects } from "@auditrail/db/schema";
import { and, desc, eq } from "drizzle-orm";

import type { AppDatabase } from "../../plugins/database.js";
import type { ApiKeyRepo, ManagedApiKey } from "./service.js";
import type { Membership } from "../platform/service.js";

export function createPostgresApiKeyRepo(db: AppDatabase): ApiKeyRepo {
  return {
    async create(input) {
      const [record] = await db.insert(apiKeys).values(input).returning();

      return toManagedApiKey(record);
    },
    async findMembership(input) {
      const [record] = await db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, input.organizationId),
            eq(organizationMemberships.userId, input.userId)
          )
        )
        .limit(1);

      if (!record) {
        return undefined;
      }

      return {
        id: record.id,
        organizationId: record.organizationId,
        role: record.role as Membership["role"],
        userId: record.userId
      };
    },
    async findProject(input) {
      const [record] = await db
        .select({
          id: projects.id
        })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, input.organizationId)
          )
        )
        .limit(1);

      return record;
    },
    async listByProject(input) {
      const records = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.projectId, input.projectId))
        .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id));

      return records.map(toManagedApiKey);
    },
    async revoke(input) {
      const records = await db
        .update(apiKeys)
        .set({
          revoked: true
        })
        .where(
          and(eq(apiKeys.id, input.apiKeyId), eq(apiKeys.projectId, input.projectId))
        )
        .returning({
          id: apiKeys.id
        });

      return records.length > 0;
    }
  };
}

function toManagedApiKey(record: typeof apiKeys.$inferSelect): ManagedApiKey {
  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    keyPrefix: record.keyPrefix,
    lastUsedAt: record.lastUsedAt?.toISOString(),
    name: record.name,
    projectId: record.projectId,
    revoked: record.revoked
  };
}
