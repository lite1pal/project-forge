create table if not exists "customers" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "name" text not null,
  "email" text not null,
  "is_active" boolean not null,
  "status" text not null,
  "external_id" uuid,
  "last_contacted_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
create index if not exists "customers_organization_id_idx"
  on "customers" ("organization_id");