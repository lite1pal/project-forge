import type { TodoRecord } from "@auditrail/domain/generated/todo";
import { todoTable } from "@auditrail/db/schema";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";

import type { AppDatabase } from "../../../plugins/database.js";
import type { TodoRepo } from "./repo.js";

export function createPostgresTodoRepo(db: AppDatabase): TodoRepo {
  return {
    async create(input) {
      const [record] = await db.insert(todoTable).values({
        organizationId: input.organizationId,
        title: input.data.title,
        details: input.data.details,
        status: input.data.status,
        dueAt: input.data.dueAt ? new Date(input.data.dueAt) : undefined,
      }).returning();

      return toTodoRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(todoTable).where(
        and(
          eq(todoTable.id, input.id),
          eq(todoTable.organizationId, input.organizationId)
        )
      ).limit(1);

      return record ? toTodoRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const [cursorRecord] = input.filters.cursor ? await db.select({
        createdAt: todoTable.createdAt,
        id: todoTable.id
      }).from(todoTable).where(
        and(
          eq(todoTable.id, input.filters.cursor),
          eq(todoTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      const records = await db.select().from(todoTable).where(
        and(
          eq(todoTable.organizationId, input.organizationId),
          pattern
            ? or(
      ilike(sql`cast(${todoTable.title} as text)`, pattern)
            )
            : undefined,
          cursorRecord
            ? or(
                lt(todoTable.createdAt, cursorRecord.createdAt),
                and(
                  eq(todoTable.createdAt, cursorRecord.createdAt),
                  lt(todoTable.id, cursorRecord.id)
                )
              )
            : undefined
        )
      ).orderBy(desc(todoTable.createdAt), desc(todoTable.id)).limit(limit);

      return records.map(toTodoRecord);
    },
    async update(input) {
      const [record] = await db.update(todoTable).set({
        title: input.data.title !== undefined ? input.data.title : undefined,
        details: input.data.details !== undefined ? input.data.details : undefined,
        status: input.data.status !== undefined ? input.data.status : undefined,
        dueAt: input.data.dueAt !== undefined ? input.data.dueAt ? new Date(input.data.dueAt) : undefined : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(todoTable.id, input.id),
          eq(todoTable.organizationId, input.organizationId)
        )
      ).returning();

      return record ? toTodoRecord(record) : undefined;
    }
  };
}

function toTodoRecord(
  record: typeof todoTable.$inferSelect
): TodoRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    title: record.title,
    details: record.details ?? undefined,
    status: record.status as TodoRecord["status"],
    dueAt: record.dueAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
