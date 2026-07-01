import type { CustomerRecord } from "@auditrail/domain/generated/customer";
import { customerTable } from "@auditrail/db/schema";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";

import type { AppDatabase } from "../../../plugins/database.js";
import type { CustomerRepo } from "./repo.js";

export function createPostgresCustomerRepo(db: AppDatabase): CustomerRepo {
  return {
    async create(input) {
      const [record] = await db.insert(customerTable).values({
        organizationId: input.organizationId,
        name: input.data.name,
        email: input.data.email,
        isActive: input.data.isActive,
        status: input.data.status,
        externalId: input.data.externalId,
        lastContactedAt: input.data.lastContactedAt ? new Date(input.data.lastContactedAt) : undefined,
      }).returning();

      return toCustomerRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(customerTable).where(
        and(
          eq(customerTable.id, input.id),
          eq(customerTable.organizationId, input.organizationId)
        )
      ).limit(1);

      return record ? toCustomerRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const [cursorRecord] = input.filters.cursor ? await db.select({
        createdAt: customerTable.createdAt,
        id: customerTable.id
      }).from(customerTable).where(
        and(
          eq(customerTable.id, input.filters.cursor),
          eq(customerTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      const records = await db.select().from(customerTable).where(
        and(
          eq(customerTable.organizationId, input.organizationId),
          pattern
            ? or(
      ilike(sql`cast(${customerTable.name} as text)`, pattern)
            )
            : undefined,
          cursorRecord
            ? or(
                lt(customerTable.createdAt, cursorRecord.createdAt),
                and(
                  eq(customerTable.createdAt, cursorRecord.createdAt),
                  lt(customerTable.id, cursorRecord.id)
                )
              )
            : undefined
        )
      ).orderBy(desc(customerTable.createdAt), desc(customerTable.id)).limit(limit);

      return records.map(toCustomerRecord);
    },
    async update(input) {
      const [record] = await db.update(customerTable).set({
        name: input.data.name !== undefined ? input.data.name : undefined,
        email: input.data.email !== undefined ? input.data.email : undefined,
        isActive: input.data.isActive !== undefined ? input.data.isActive : undefined,
        status: input.data.status !== undefined ? input.data.status : undefined,
        externalId: input.data.externalId !== undefined ? input.data.externalId : undefined,
        lastContactedAt: input.data.lastContactedAt !== undefined ? input.data.lastContactedAt ? new Date(input.data.lastContactedAt) : undefined : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(customerTable.id, input.id),
          eq(customerTable.organizationId, input.organizationId)
        )
      ).returning();

      return record ? toCustomerRecord(record) : undefined;
    }
  };
}

function toCustomerRecord(
  record: typeof customerTable.$inferSelect
): CustomerRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    email: record.email,
    isActive: record.isActive,
    status: record.status as CustomerRecord["status"],
    externalId: record.externalId ?? undefined,
    lastContactedAt: record.lastContactedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
