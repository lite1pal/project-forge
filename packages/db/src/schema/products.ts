import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { organizations } from "./identity.js";

export const organizationInstalledProducts = pgTable(
  "organization_installed_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    productId: text("product_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("organization_installed_products_org_enabled_idx").on(
      table.organizationId,
      table.enabled
    ),
    uniqueIndex("organization_installed_products_org_product_unique")
      .on(table.organizationId, table.productId)
      .where(sql`true`)
  ]
);
