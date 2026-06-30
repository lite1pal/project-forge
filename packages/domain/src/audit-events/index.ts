import { z } from "zod";

export * from "./onboarding.js";
export * from "./product-module.js";
export * from "./product.js";

export const auditEventMetadataSchema = z
  .record(z.string(), z.unknown())
  .default({});

export const ingestAuditEventSchema = z.object({
  event: z.string().trim().min(1).max(200),
  actor: z.string().trim().min(1).max(200).optional(),
  target: z.string().trim().min(1).max(200).optional(),
  metadata: auditEventMetadataSchema
});

export type IngestAuditEventInput = z.infer<typeof ingestAuditEventSchema>;
