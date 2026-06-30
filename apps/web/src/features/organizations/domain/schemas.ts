import { billingProviderSchema, billingStatusSchema } from "@auditrail/domain/billing";
import {
  projectWebhookDeliveryStatusSchema,
  projectWebhookEventTypeSchema
} from "@auditrail/domain";
import { z } from "zod";

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string()
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string()
});

export const organizationPlanIdSchema = z.enum(["starter", "growth", "scale"]);

export const organizationPlanSummarySchema = z.object({
  id: organizationPlanIdSchema,
  name: z.string(),
  includedEvents: z.number().int(),
  usedEvents: z.number().int(),
  remainingEvents: z.number().int(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime()
});

export const membershipSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
  userId: z.string()
});

export const organizationMemberSchema = z.object({
  email: z.string().email(),
  id: z.string(),
  name: z.string().optional(),
  role: z.enum(["owner", "admin", "member", "viewer"])
});

export const organizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema)
});

export const createOrganizationResponseSchema = z.object({
  membership: membershipSchema,
  organization: organizationSchema
});

export const projectsResponseSchema = z.object({
  projects: z.array(projectSchema)
});

export const createProjectResponseSchema = z.object({
  project: projectSchema
});

export const organizationMembersResponseSchema = z.object({
  members: z.array(organizationMemberSchema)
});

export const changeOrganizationPlanResponseSchema = z.object({
  organizationId: z.string(),
  planId: organizationPlanIdSchema
});

export const billingCustomerSummarySchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string(),
  provider: billingProviderSchema,
  providerCustomerId: z.string(),
  updatedAt: z.string().datetime()
});

export const billingSubscriptionSummarySchema = z.object({
  billingCustomerId: z.string(),
  billingPlanId: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.string().datetime(),
  currentPeriodEnd: z.string().datetime().optional(),
  currentPeriodStart: z.string().datetime().optional(),
  entitlementPlanId: z.string(),
  id: z.string(),
  provider: billingProviderSchema,
  providerPriceId: z.string(),
  providerProductId: z.string().optional(),
  providerSubscriptionId: z.string(),
  status: billingStatusSchema,
  updatedAt: z.string().datetime()
});

export const organizationBillingStatusSchema = z.object({
  customer: billingCustomerSummarySchema.nullable(),
  organizationId: z.string(),
  providerConfigurationStatus: z.enum(["configured", "not_configured"]),
  subscription: billingSubscriptionSummarySchema.nullable()
});

export const billingSessionLinkSchema = z.object({
  provider: billingProviderSchema,
  url: z.string().url()
});

export const projectWebhookDeliverySchema = z.object({
  attemptCount: z.number().int(),
  auditEventCreatedAt: z.string().datetime(),
  auditEventId: z.string(),
  auditEventType: z.string(),
  createdAt: z.string().datetime(),
  deliveredAt: z.string().datetime().optional(),
  endpointId: z.string(),
  id: z.string(),
  lastError: z.string().optional(),
  maxAttempts: z.number().int(),
  nextRetryAt: z.string().datetime().optional(),
  responseBodySummary: z.string().optional(),
  responseStatusCode: z.number().int().optional(),
  status: projectWebhookDeliveryStatusSchema,
  updatedAt: z.string().datetime()
});

export const projectWebhookEndpointSchema = z.object({
  createdAt: z.string().datetime(),
  enabled: z.boolean(),
  id: z.string(),
  latestDelivery: projectWebhookDeliverySchema.nullable(),
  organizationId: z.string(),
  projectId: z.string(),
  subscribedEventTypes: z.array(projectWebhookEventTypeSchema).min(1),
  updatedAt: z.string().datetime(),
  url: z.string().url()
});

export const projectWebhookListResponseSchema = z.object({
  endpoints: z.array(projectWebhookEndpointSchema)
});

export const projectWebhookResponseSchema = projectWebhookEndpointSchema;

export const createProjectWebhookResponseSchema = z.object({
  endpoint: projectWebhookEndpointSchema,
  secret: z.string()
});

export const rotateProjectWebhookSecretResponseSchema = z.object({
  endpoint: projectWebhookEndpointSchema,
  secret: z.string()
});

export type Organization = z.infer<typeof organizationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationPlanId = z.infer<typeof organizationPlanIdSchema>;
export type OrganizationPlanSummary = z.infer<typeof organizationPlanSummarySchema>;
export type OrganizationBillingStatus = z.infer<typeof organizationBillingStatusSchema>;
export type BillingSessionLink = z.infer<typeof billingSessionLinkSchema>;
export type ProjectWebhookEndpoint = z.infer<typeof projectWebhookEndpointSchema>;
