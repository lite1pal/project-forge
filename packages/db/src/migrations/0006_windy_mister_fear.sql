ALTER TABLE "organization_monthly_usage" RENAME COLUMN "event_count" TO "quantity";--> statement-breakpoint
ALTER TABLE "organization_monthly_usage" ADD COLUMN "meter_key" text;--> statement-breakpoint
UPDATE "organization_monthly_usage" SET "meter_key" = 'events' WHERE "meter_key" IS NULL;--> statement-breakpoint
ALTER TABLE "organization_monthly_usage" ALTER COLUMN "meter_key" SET NOT NULL;--> statement-breakpoint
DROP INDEX "organization_monthly_usage_org_month_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "organization_monthly_usage_org_month_unique" ON "organization_monthly_usage" USING btree ("organization_id","month_start","meter_key");
