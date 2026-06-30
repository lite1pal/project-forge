import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { auditEvents } from "./audit-events.js";
import { organizations, projects } from "./identity.js";

export const projectWebhookEndpoints = pgTable(
  "project_webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    subscribedEventTypes: text("subscribed_event_types")
      .array()
      .notNull()
      .default(sql`ARRAY['audit.event.created']::text[]`),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),
    secretRotatedAt: timestamp("secret_rotated_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("project_webhook_endpoints_org_project_idx").on(
      table.organizationId,
      table.projectId
    ),
    index("project_webhook_endpoints_project_enabled_idx").on(
      table.projectId,
      table.enabled
    )
  ]
);

export const projectWebhookDeliveries = pgTable(
  "project_webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => projectWebhookEndpoints.id),
    auditEventId: uuid("audit_event_id")
      .notNull()
      .references(() => auditEvents.id),
    auditEventType: text("audit_event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    responseStatusCode: integer("response_status_code"),
    responseBodySummary: text("response_body_summary"),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true
    }),
    deliveredAt: timestamp("delivered_at", {
      withTimezone: true
    }),
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
    index("project_webhook_deliveries_endpoint_status_idx").on(
      table.endpointId,
      table.status
    ),
    index("project_webhook_deliveries_project_created_at_idx").on(
      table.projectId,
      table.createdAt
    ),
    uniqueIndex("project_webhook_deliveries_endpoint_event_unique").on(
      table.endpointId,
      table.auditEventId
    )
  ]
);
