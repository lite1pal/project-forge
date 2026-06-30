create table if not exists "organization_installed_products" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "product_id" text not null,
  "enabled" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "organization_installed_products_org_enabled_idx"
  on "organization_installed_products" ("organization_id", "enabled");
--> statement-breakpoint
create unique index if not exists "organization_installed_products_org_product_unique"
  on "organization_installed_products" ("organization_id", "product_id");
