create table if not exists "project_webhook_endpoints" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "project_id" uuid not null references "projects"("id"),
  "url" text not null,
  "secret" text not null,
  "enabled" boolean default true not null,
  "subscribed_event_types" text[] default ARRAY['audit.event.created']::text[] not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "secret_rotated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "project_webhook_endpoints_org_project_idx"
  on "project_webhook_endpoints" ("organization_id", "project_id");
--> statement-breakpoint
create index if not exists "project_webhook_endpoints_project_enabled_idx"
  on "project_webhook_endpoints" ("project_id", "enabled");
--> statement-breakpoint
create table if not exists "project_webhook_deliveries" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "project_id" uuid not null references "projects"("id"),
  "endpoint_id" uuid not null references "project_webhook_endpoints"("id"),
  "audit_event_id" uuid not null references "audit_events"("id"),
  "audit_event_type" text not null,
  "payload" jsonb default '{}'::jsonb not null,
  "status" text default 'pending' not null,
  "attempt_count" integer default 0 not null,
  "max_attempts" integer default 5 not null,
  "response_status_code" integer,
  "response_body_summary" text,
  "last_error" text,
  "next_retry_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "project_webhook_deliveries_endpoint_status_idx"
  on "project_webhook_deliveries" ("endpoint_id", "status");
--> statement-breakpoint
create index if not exists "project_webhook_deliveries_project_created_at_idx"
  on "project_webhook_deliveries" ("project_id", "created_at");
--> statement-breakpoint
create unique index if not exists "project_webhook_deliveries_endpoint_event_unique"
  on "project_webhook_deliveries" ("endpoint_id", "audit_event_id");
