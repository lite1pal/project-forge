import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  planId: text("plan_id").notNull().default("starter"),
  createdAt: timestamp("created_at", {
    withTimezone: true
  })
    .notNull()
    .defaultNow()
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    environment: text("environment").notNull().default("production"),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [index("projects_organization_id_idx").on(table.organizationId)]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    name: text("name").notNull(),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true
    })
  },
  (table) => [
    index("api_keys_project_id_idx").on(table.projectId),
    index("api_keys_key_prefix_idx").on(table.keyPrefix),
    index("api_keys_active_key_hash_idx")
      .on(table.keyHash)
      .where(sql`${table.revoked} = false`)
  ]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name"),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [index("users_email_idx").on(table.email)]
);

export const authMagicLinks = pgTable(
  "auth_magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true
    }).notNull(),
    consumedAt: timestamp("consumed_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("auth_magic_links_email_idx").on(table.email),
    index("auth_magic_links_token_hash_idx").on(table.tokenHash)
  ]
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true
    }).notNull(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("auth_sessions_user_id_idx").on(table.userId),
    index("auth_sessions_token_hash_idx").on(table.tokenHash)
  ]
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("organization_memberships_organization_id_idx").on(table.organizationId),
    index("organization_memberships_user_id_idx").on(table.userId),
    uniqueIndex("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId
    )
  ]
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true
    }).notNull(),
    acceptedAt: timestamp("accepted_at", {
      withTimezone: true
    }),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("organization_invitations_organization_id_idx").on(
      table.organizationId
    ),
    index("organization_invitations_email_idx").on(table.email),
    index("organization_invitations_token_hash_idx").on(table.tokenHash),
    uniqueIndex("organization_invitations_pending_org_email_unique")
      .on(table.organizationId, table.email)
      .where(
        sql`${table.acceptedAt} is null and ${table.revokedAt} is null`
      )
  ]
);

export const userOrganizationOnboardingStates = pgTable(
  "user_organization_onboarding_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    dismissedAt: timestamp("dismissed_at", {
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
    index("user_org_onboarding_states_org_id_idx").on(table.organizationId),
    index("user_org_onboarding_states_user_id_idx").on(table.userId),
    uniqueIndex("user_org_onboarding_states_org_user_unique").on(
      table.organizationId,
      table.userId
    )
  ]
);

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"),
    filters: jsonb("filters").notNull().default({}),
    objectKey: text("object_key"),
    error: text("error"),
    completedAt: timestamp("completed_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("export_jobs_project_id_idx").on(table.projectId),
    index("export_jobs_status_idx").on(table.status)
  ]
);

export const organizationMonthlyUsage = pgTable(
  "organization_monthly_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    monthStart: timestamp("month_start", {
      withTimezone: true
    }).notNull(),
    meterKey: text("meter_key").notNull(),
    quantity: integer("quantity").notNull().default(0),
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
    index("organization_monthly_usage_organization_id_idx").on(
      table.organizationId
    ),
    uniqueIndex("organization_monthly_usage_org_month_unique").on(
      table.organizationId,
      table.monthStart,
      table.meterKey
    )
  ]
);
