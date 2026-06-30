import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const urlSchema = z
  .url()
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
    message: "Webhook URLs must use http or https."
  });

export const projectWebhookEventTypes = ["audit.event.created"] as const;
export type ProjectWebhookEventType = (typeof projectWebhookEventTypes)[number];

export const projectWebhookDeliveryStatuses = [
  "pending",
  "delivering",
  "succeeded",
  "failed"
] as const;
export type ProjectWebhookDeliveryStatus =
  (typeof projectWebhookDeliveryStatuses)[number];

export const webhookSignatureTimestampHeader = "x-auditrail-webhook-timestamp";
export const webhookSignatureHeader = "x-auditrail-webhook-signature";
export const webhookEventHeader = "x-auditrail-webhook-event";

export const webhookDeliveryJobName = "project.webhook.deliver" as const;
export const defaultProjectWebhookMaxAttempts = 5;

export const projectWebhookEventTypeSchema = z.enum(projectWebhookEventTypes);
export const projectWebhookDeliveryStatusSchema = z.enum(
  projectWebhookDeliveryStatuses
);

export const projectWebhookEndpointSchema = z.object({
  createdAt: z.string().datetime(),
  enabled: z.boolean(),
  id: nonEmptyStringSchema,
  organizationId: nonEmptyStringSchema,
  projectId: nonEmptyStringSchema,
  subscribedEventTypes: z.array(projectWebhookEventTypeSchema).min(1),
  updatedAt: z.string().datetime(),
  url: urlSchema
});

export const projectWebhookEndpointSecretSchema = z.object({
  secret: nonEmptyStringSchema
});

export const projectWebhookDeliverySchema = z.object({
  attemptCount: z.number().int().nonnegative(),
  auditEventCreatedAt: z.string().datetime(),
  auditEventId: nonEmptyStringSchema,
  auditEventType: nonEmptyStringSchema,
  createdAt: z.string().datetime(),
  deliveredAt: z.string().datetime().optional(),
  endpointId: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  lastError: nonEmptyStringSchema.optional(),
  maxAttempts: z.number().int().positive(),
  nextRetryAt: z.string().datetime().optional(),
  responseBodySummary: z.string().optional(),
  responseStatusCode: z.number().int().optional(),
  status: projectWebhookDeliveryStatusSchema,
  updatedAt: z.string().datetime()
});

export const projectWebhookPayloadSchema = z.object({
  createdAt: z.string().datetime(),
  data: z.object({
    auditEvent: z.object({
      actorId: z.string().optional(),
      createdAt: z.string().datetime(),
      eventType: nonEmptyStringSchema,
      id: nonEmptyStringSchema,
      metadata: z.record(z.string(), z.unknown()),
      targetId: z.string().optional()
    })
  }),
  id: nonEmptyStringSchema,
  organizationId: nonEmptyStringSchema,
  projectId: nonEmptyStringSchema,
  type: projectWebhookEventTypeSchema
});

export const projectWebhookDeliveryJobPayloadSchema = z.object({
  deliveryId: nonEmptyStringSchema
});

export const createProjectWebhookEndpointSchema = z.object({
  subscribedEventTypes: z.array(projectWebhookEventTypeSchema).min(1),
  url: urlSchema
});

export const updateProjectWebhookEndpointSchema = z.object({
  enabled: z.boolean().optional(),
  subscribedEventTypes: z.array(projectWebhookEventTypeSchema).min(1).optional(),
  url: urlSchema.optional()
});

export type ProjectWebhookEndpoint = z.infer<typeof projectWebhookEndpointSchema>;
export type ProjectWebhookDelivery = z.infer<typeof projectWebhookDeliverySchema>;
export type ProjectWebhookPayload = z.infer<typeof projectWebhookPayloadSchema>;
export type ProjectWebhookDeliveryJobPayload = z.infer<
  typeof projectWebhookDeliveryJobPayloadSchema
>;
