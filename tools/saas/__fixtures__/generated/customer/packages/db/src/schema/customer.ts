import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./identity.js";

export const customerTable = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    isActive: boolean("is_active").notNull(),
    status: text("status").notNull(),
    externalId: uuid("external_id"),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("customers_organization_id_idx").on(table.organizationId)
  ]
);
