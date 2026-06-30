import {
  projectWebhookDeliveries,
  projectWebhookEndpoints,
  projects
} from "@auditrail/db/schema";
import { desc, eq, inArray, and, sql } from "drizzle-orm";

import type { AppDatabase } from "../../../plugins/database.js";
import type { ProjectWebhookDelivery } from "@auditrail/domain";
import type {
  PlatformProjectWebhooksRepo,
  ProjectWebhookEndpointRecord
} from "./repo.js";
import { organizationMemberships } from "@auditrail/db/schema";

export function createPostgresPlatformProjectWebhooksRepo(
  db: AppDatabase,
  options: {
    now?: () => Date;
  } = {}
): PlatformProjectWebhooksRepo {
  const now = options.now ?? (() => new Date());

  return {
    async createProjectWebhookEndpoint(input) {
      const [record] = await db
        .insert(projectWebhookEndpoints)
        .values({
          enabled: input.enabled ?? true,
          organizationId: input.organizationId,
          projectId: input.projectId,
          secret: input.secret,
          secretRotatedAt: now(),
          subscribedEventTypes: input.subscribedEventTypes,
          updatedAt: now(),
          url: input.url
        })
        .returning();

      return toProjectWebhookEndpointRecord(record);
    },
    async deleteProjectWebhookEndpoint(input) {
      const [record] = await db
        .delete(projectWebhookEndpoints)
        .where(
          and(
            eq(projectWebhookEndpoints.id, input.endpointId),
            eq(projectWebhookEndpoints.organizationId, input.organizationId),
            eq(projectWebhookEndpoints.projectId, input.projectId)
          )
        )
        .returning({
          id: projectWebhookEndpoints.id
        });

      return Boolean(record);
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

      return record
        ? {
            id: record.id,
            organizationId: record.organizationId,
            role: record.role as "owner" | "admin" | "member" | "viewer",
            userId: record.userId
          }
        : undefined;
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
    async findProjectWebhookEndpoint(input) {
      const [record] = await db
        .select()
        .from(projectWebhookEndpoints)
        .where(
          and(
            eq(projectWebhookEndpoints.id, input.endpointId),
            eq(projectWebhookEndpoints.organizationId, input.organizationId),
            eq(projectWebhookEndpoints.projectId, input.projectId)
          )
        )
        .limit(1);

      return record ? toProjectWebhookEndpointRecord(record) : undefined;
    },
    async listLatestDeliveriesByEndpointIds(endpointIds) {
      if (endpointIds.length === 0) {
        return new Map();
      }

      const latestCreatedAt = db.$with("latest_deliveries").as(
        db
          .select({
            endpointId: projectWebhookDeliveries.endpointId,
            createdAt: sql<Date>`max(${projectWebhookDeliveries.createdAt})`
          })
          .from(projectWebhookDeliveries)
          .where(inArray(projectWebhookDeliveries.endpointId, endpointIds))
          .groupBy(projectWebhookDeliveries.endpointId)
      );
      const records = await db
        .with(latestCreatedAt)
        .select({
          id: projectWebhookDeliveries.id,
          endpointId: projectWebhookDeliveries.endpointId,
          auditEventId: projectWebhookDeliveries.auditEventId,
          auditEventType: projectWebhookDeliveries.auditEventType,
          attemptCount: projectWebhookDeliveries.attemptCount,
          maxAttempts: projectWebhookDeliveries.maxAttempts,
          status: projectWebhookDeliveries.status,
          responseStatusCode: projectWebhookDeliveries.responseStatusCode,
          responseBodySummary: projectWebhookDeliveries.responseBodySummary,
          lastError: projectWebhookDeliveries.lastError,
          nextRetryAt: projectWebhookDeliveries.nextRetryAt,
          deliveredAt: projectWebhookDeliveries.deliveredAt,
          createdAt: projectWebhookDeliveries.createdAt,
          updatedAt: projectWebhookDeliveries.updatedAt,
          auditEventCreatedAt: sql<Date>`cast(${projectWebhookDeliveries.payload}->>'createdAt' as timestamptz)`
        })
        .from(projectWebhookDeliveries)
        .innerJoin(
          latestCreatedAt,
          and(
            eq(projectWebhookDeliveries.endpointId, latestCreatedAt.endpointId),
            eq(projectWebhookDeliveries.createdAt, latestCreatedAt.createdAt)
          )
        )
        .orderBy(desc(projectWebhookDeliveries.createdAt));

      return new Map(
        records.map((record) => [
          record.endpointId,
          {
            attemptCount: record.attemptCount,
            auditEventCreatedAt: record.auditEventCreatedAt.toISOString(),
            auditEventId: record.auditEventId,
            auditEventType: record.auditEventType,
            createdAt: record.createdAt.toISOString(),
            deliveredAt: record.deliveredAt?.toISOString(),
            endpointId: record.endpointId,
            id: record.id,
            lastError: record.lastError ?? undefined,
            maxAttempts: record.maxAttempts,
            nextRetryAt: record.nextRetryAt?.toISOString(),
            responseBodySummary: record.responseBodySummary ?? undefined,
            responseStatusCode: record.responseStatusCode ?? undefined,
            status: record.status as ProjectWebhookDelivery["status"],
            updatedAt: record.updatedAt.toISOString()
          }
        ])
      );
    },
    async listProjectWebhookEndpoints(input) {
      const records = await db
        .select()
        .from(projectWebhookEndpoints)
        .where(
          and(
            eq(projectWebhookEndpoints.organizationId, input.organizationId),
            eq(projectWebhookEndpoints.projectId, input.projectId)
          )
        )
        .orderBy(desc(projectWebhookEndpoints.createdAt));

      return records.map(toProjectWebhookEndpointRecord);
    },
    async rotateProjectWebhookSecret(input) {
      const [record] = await db
        .update(projectWebhookEndpoints)
        .set({
          secret: input.secret,
          secretRotatedAt: now(),
          updatedAt: now()
        })
        .where(
          and(
            eq(projectWebhookEndpoints.id, input.endpointId),
            eq(projectWebhookEndpoints.organizationId, input.organizationId),
            eq(projectWebhookEndpoints.projectId, input.projectId)
          )
        )
        .returning();

      return record ? toProjectWebhookEndpointRecord(record) : undefined;
    },
    async updateProjectWebhookEndpoint(input) {
      const [record] = await db
        .update(projectWebhookEndpoints)
        .set({
          enabled: input.enabled,
          subscribedEventTypes: input.subscribedEventTypes,
          updatedAt: now(),
          url: input.url
        })
        .where(
          and(
            eq(projectWebhookEndpoints.id, input.endpointId),
            eq(projectWebhookEndpoints.organizationId, input.organizationId),
            eq(projectWebhookEndpoints.projectId, input.projectId)
          )
        )
        .returning();

      return record ? toProjectWebhookEndpointRecord(record) : undefined;
    }
  };
}

function toProjectWebhookEndpointRecord(
  record: typeof projectWebhookEndpoints.$inferSelect
): ProjectWebhookEndpointRecord {
  return {
    createdAt: record.createdAt.toISOString(),
    enabled: record.enabled,
    id: record.id,
    organizationId: record.organizationId,
    projectId: record.projectId,
    secret: record.secret,
    secretRotatedAt: record.secretRotatedAt.toISOString(),
    subscribedEventTypes: record.subscribedEventTypes as ProjectWebhookEndpointRecord["subscribedEventTypes"],
    updatedAt: record.updatedAt.toISOString(),
    url: record.url
  };
}
