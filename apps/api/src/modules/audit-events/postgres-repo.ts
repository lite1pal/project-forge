import { auditEvents } from "@auditrail/db/schema";
import type { IngestAuditEventInput } from "@auditrail/domain/audit-events";
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
  AuditEventRepo,
  AuditEventSummaryFilters,
  AuditEventTimeseriesFilters,
  AuditEventTenant
} from "./repo.js";
import type { AppDatabase } from "../../plugins/database.js";
import { decodeAuditEventCursor } from "./cursor.js";

export function createPostgresAuditEventRepo(db: AppDatabase): AuditEventRepo {
  return {
    async append(tenant: AuditEventTenant, input: IngestAuditEventInput) {
      const [record] = await db
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

      return {
        id: record.id,
        eventType: record.eventType,
        actorId: record.actorId ?? undefined,
        targetId: record.targetId ?? undefined,
        metadata: record.metadata as Record<string, unknown>,
        createdAt: record.createdAt.toISOString()
      } satisfies AuditEventRecord;
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
