import {
  auditEvents,
  jobOutbox,
  organizationMonthlyUsage,
  organizations,
  projectWebhookDeliveries,
  projectWebhookEndpoints
} from "@auditrail/db/schema";
import { defaultProjectWebhookMaxAttempts } from "@auditrail/domain";
import type { IngestAuditEventInput } from "@auditrail/domain/audit-events";
import {
  getPricingPlan,
  getUtcMonthWindow,
  summarizePricingUsage,
  type PricingPlanId
} from "@auditrail/domain/pricing";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql
} from "drizzle-orm";

import type {
  AuditEventListFilters,
  AuditEventRecord,
  AuditEventQuotaState,
  AuditEventRepo,
  AuditEventSummaryFilters,
  AuditEventTimeseriesFilters,
  AuditEventTenant
} from "./repo.js";
import type { AppDatabase } from "../../plugins/database.js";
import { decodeAuditEventCursor } from "./cursor.js";
import {
  createAuditEventCreatedJob,
  createProjectWebhookDeliveryJob,
  createProjectWebhookPayload
} from "./jobs.js";
import { EventQuotaExceededError } from "./repo.js";

export function createPostgresAuditEventRepo(
  db: AppDatabase,
  options: {
    now?: () => Date;
  } = {}
): AuditEventRepo {
  const now = options.now ?? (() => new Date());
  const usageMeterKey = "events";

  return {
    async append(
      tenant: AuditEventTenant,
      input: IngestAuditEventInput,
      options?: {
        quota?: AuditEventQuotaState;
      }
    ) {
      const currentTime = now();
      const window = getUtcMonthWindow(currentTime);

      return db.transaction(async (tx) => {
        const quota = options?.quota;
        let planId = quota?.id as PricingPlanId | undefined;
        let includedEvents = quota?.includedEvents;

        if (includedEvents === undefined || !planId) {
          const [organizationRecord] = await tx
            .select({
              planId: organizations.planId
            })
            .from(organizations)
            .where(eq(organizations.id, tenant.organizationId))
            .limit(1);

          planId = (organizationRecord?.planId ?? "starter") as PricingPlanId;
          includedEvents = getPricingPlan(planId).includedEvents;
        }

        const monthStart = new Date(window.periodStart);

        await tx
          .insert(organizationMonthlyUsage)
          .values({
            meterKey: usageMeterKey,
            monthStart,
            organizationId: tenant.organizationId,
            quantity: 0,
            updatedAt: currentTime
          })
          .onConflictDoNothing({
            target: [
              organizationMonthlyUsage.organizationId,
              organizationMonthlyUsage.monthStart,
              organizationMonthlyUsage.meterKey
            ]
          });

        const [usageRecord] = await tx
          .update(organizationMonthlyUsage)
          .set({
            quantity: sql`${organizationMonthlyUsage.quantity} + 1`,
            updatedAt: currentTime
          })
          .where(
            and(
              eq(organizationMonthlyUsage.organizationId, tenant.organizationId),
              eq(organizationMonthlyUsage.monthStart, monthStart),
              eq(organizationMonthlyUsage.meterKey, usageMeterKey),
              sql`${organizationMonthlyUsage.quantity} < ${includedEvents}`
            )
          )
          .returning({
            quantity: organizationMonthlyUsage.quantity
          });

        if (!usageRecord) {
          const [currentUsageRecord] = await tx
            .select({
              quantity: organizationMonthlyUsage.quantity
            })
            .from(organizationMonthlyUsage)
            .where(
              and(
                eq(organizationMonthlyUsage.organizationId, tenant.organizationId),
                eq(organizationMonthlyUsage.monthStart, monthStart),
                eq(organizationMonthlyUsage.meterKey, usageMeterKey)
              )
            )
            .limit(1);

          throw new EventQuotaExceededError(
            summarizePricingUsage({
              now: currentTime,
              planId,
              usedEvents: currentUsageRecord?.quantity ?? includedEvents
            })
          );
        }

        const [record] = await tx
          .insert(auditEvents)
          .values({
            organizationId: tenant.organizationId,
            projectId: tenant.projectId,
            eventType: input.event,
            actorId: input.actor,
            targetId: input.target,
            metadata: input.metadata
          })
          .returning({
            id: auditEvents.id,
            eventType: auditEvents.eventType,
            actorId: auditEvents.actorId,
            targetId: auditEvents.targetId,
            metadata: auditEvents.metadata,
            createdAt: auditEvents.createdAt
          });

        const eventRecord = {
          id: record.id,
          eventType: record.eventType,
          actorId: record.actorId ?? undefined,
          targetId: record.targetId ?? undefined,
          metadata: record.metadata as Record<string, unknown>,
          createdAt: record.createdAt.toISOString()
        } satisfies AuditEventRecord;

        await tx.insert(jobOutbox).values(
          createAuditEventCreatedJob({
            event: eventRecord,
            tenant
          })
        );

        const subscribedWebhookEventType = "audit.event.created";
        const webhookEndpoints = await tx
          .select({
            id: projectWebhookEndpoints.id
          })
          .from(projectWebhookEndpoints)
          .where(
            and(
              eq(projectWebhookEndpoints.organizationId, tenant.organizationId),
              eq(projectWebhookEndpoints.projectId, tenant.projectId),
              eq(projectWebhookEndpoints.enabled, true),
              sql`${projectWebhookEndpoints.subscribedEventTypes} @> ARRAY[${subscribedWebhookEventType}]::text[]`
            )
          );

        if (webhookEndpoints.length > 0) {
          const payload = createProjectWebhookPayload({
            event: eventRecord,
            tenant
          });
          const deliveries = await tx
            .insert(projectWebhookDeliveries)
            .values(
              webhookEndpoints.map((endpoint) => ({
                auditEventId: eventRecord.id,
                auditEventType: eventRecord.eventType,
                endpointId: endpoint.id,
                maxAttempts: defaultProjectWebhookMaxAttempts,
                organizationId: tenant.organizationId,
                payload,
                projectId: tenant.projectId,
                updatedAt: currentTime
              }))
            )
            .returning({
              id: projectWebhookDeliveries.id,
              maxAttempts: projectWebhookDeliveries.maxAttempts
            });

          await tx.insert(jobOutbox).values(
            deliveries.map((delivery) => ({
              ...createProjectWebhookDeliveryJob({
                deliveryId: delivery.id
              }),
              maxAttempts: delivery.maxAttempts
            }))
          );
        }

        return eventRecord;
      });
    },
    async list(tenant: AuditEventTenant, filters: AuditEventListFilters) {
      const cursor = filters.cursor
        ? decodeAuditEventCursor(filters.cursor)
        : undefined;
      const records = await db
        .select({
          id: auditEvents.id,
          eventType: auditEvents.eventType,
          actorId: auditEvents.actorId,
          targetId: auditEvents.targetId,
          metadata: auditEvents.metadata,
          createdAt: auditEvents.createdAt
        })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.organizationId, tenant.organizationId),
            eq(auditEvents.projectId, tenant.projectId),
            filters.eventTypes && filters.eventTypes.length > 0
              ? inArray(auditEvents.eventType, filters.eventTypes)
              : undefined,
            filters.actorIds && filters.actorIds.length > 0
              ? inArray(auditEvents.actorId, filters.actorIds)
              : undefined,
            filters.targetIds && filters.targetIds.length > 0
              ? inArray(auditEvents.targetId, filters.targetIds)
              : undefined,
            filters.from
              ? gte(auditEvents.createdAt, new Date(filters.from))
              : undefined,
            filters.to
              ? lte(auditEvents.createdAt, new Date(filters.to))
              : undefined,
            cursor
              ? or(
                  lt(auditEvents.createdAt, new Date(cursor.createdAt)),
                  and(
                    eq(auditEvents.createdAt, new Date(cursor.createdAt)),
                    lt(auditEvents.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(filters.limit);

      return records.map((record) => ({
        id: record.id,
        eventType: record.eventType,
        actorId: record.actorId ?? undefined,
        targetId: record.targetId ?? undefined,
        metadata: record.metadata as Record<string, unknown>,
        createdAt: record.createdAt.toISOString()
      }));
    },
    async summarize(tenant: AuditEventTenant, filters: AuditEventSummaryFilters) {
      const whereClause = and(
        eq(auditEvents.organizationId, tenant.organizationId),
        eq(auditEvents.projectId, tenant.projectId),
        filters.from ? gte(auditEvents.createdAt, new Date(filters.from)) : undefined,
        filters.to ? lte(auditEvents.createdAt, new Date(filters.to)) : undefined
      );
      const countExpression = sql<number>`cast(count(*) as int)`;
      const [totalRow] = await db
        .select({
          count: countExpression
        })
        .from(auditEvents)
        .where(whereClause);
      const topEventTypes = await db
        .select({
          event: auditEvents.eventType,
          count: countExpression
        })
        .from(auditEvents)
        .where(whereClause)
        .groupBy(auditEvents.eventType)
        .orderBy(desc(countExpression), auditEvents.eventType)
        .limit(filters.top);

      return {
        totalEvents: totalRow?.count ?? 0,
        topEventTypes
      };
    },
    async timeseries(
      tenant: AuditEventTenant,
      filters: AuditEventTimeseriesFilters
    ) {
      const bucketSql =
        filters.bucket === "day"
          ? sql<string>`to_char(date_trunc('day', ${auditEvents.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
          : sql<string>`to_char(date_trunc('hour', ${auditEvents.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
      const countExpression = sql<number>`cast(count(*) as int)`;
      const rows = await db
        .select({
          bucketStart: bucketSql,
          count: countExpression
        })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.organizationId, tenant.organizationId),
            eq(auditEvents.projectId, tenant.projectId),
            gte(auditEvents.createdAt, new Date(filters.from)),
            lte(auditEvents.createdAt, new Date(filters.to))
          )
        )
        .groupBy(bucketSql)
        .orderBy(bucketSql);

      return rows;
    }
  };
}
