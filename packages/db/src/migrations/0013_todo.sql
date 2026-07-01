create table if not exists "todos" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "title" text not null,
  "details" text,
  "status" text not null,
  "due_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "todos_organization_id_idx"
  on "todos" ("organization_id");