import type { FastifyInstance } from "fastify";
import { billingProviders, billingStatuses } from "@auditrail/domain/billing";
import { z } from "zod";

import { canPerformSupportLookup } from "@auditrail/domain/internal-support";
import { registerApiSchemas, schemaIds } from "../../../http-schemas.js";
import type { AuthUser } from "../../auth/service.js";
import type { PlatformSupportService } from "./service.js";

const supportSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).optional(),
  query: z.string().trim().min(1)
});

const supportOrganizationParamsSchema = z.object({
  organizationId: z.string().min(1)
});

const supportEntitlementUsageLimitSchema = {
  additionalProperties: false,
  properties: {
    includedUnits: { minimum: 0, type: ["integer", "null"] },
    kind: { enum: ["limited", "unlimited"], type: "string" },
    meterKey: { type: "string" },
    remainingUnits: { minimum: 0, type: ["integer", "null"] },
    usedUnits: { minimum: 0, type: ["integer", "null"] }
  },
  required: ["kind", "meterKey"],
  type: "object"
} as const;

const supportEntitlementMeterUsageSchema = {
  additionalProperties: false,
  properties: {
    includedUnits: { type: ["integer", "null"] },
    kind: { enum: ["limited", "unlimited"], type: "string" },
    meterKey: { type: "string" },
    remainingUnits: { type: ["integer", "null"] },
    usedUnits: { minimum: 0, type: "integer" }
  },
  required: ["kind", "meterKey", "includedUnits", "remainingUnits", "usedUnits"],
  type: "object"
} as const;

const supportEntitlementSummarySchema = {
  additionalProperties: false,
  properties: {
    features: { items: { type: "string" }, type: "array" },
    meterUsage: {
      items: supportEntitlementMeterUsageSchema,
      type: "array"
    },
    organizationId: { type: "string" },
    periodEnd: { format: "date-time", type: "string" },
    periodStart: { format: "date-time", type: "string" },
    planId: { type: "string" },
    usedDefaultPlan: { type: "boolean" },
    usageLimits: {
      items: supportEntitlementUsageLimitSchema,
      type: "array"
    }
  },
  required: [
    "organizationId",
    "periodStart",
    "periodEnd",
    "planId",
    "usedDefaultPlan",
    "features",
    "meterUsage",
    "usageLimits"
  ],
  type: "object"
} as const;

const safeBillingCustomerSchema = {
  additionalProperties: false,
  properties: {
    createdAt: { format: "date-time", type: "string" },
    id: { type: "string" },
    provider: { enum: [...billingProviders], type: "string" },
    updatedAt: { format: "date-time", type: "string" }
  },
  required: ["id", "provider", "createdAt", "updatedAt"],
  type: "object"
} as const;

const safeBillingSubscriptionSchema = {
  additionalProperties: false,
  properties: {
    billingPlanId: { type: "string" },
    cancelAtPeriodEnd: { type: "boolean" },
    createdAt: { format: "date-time", type: "string" },
    currentPeriodEnd: { format: "date-time", type: "string" },
    currentPeriodStart: { format: "date-time", type: "string" },
    entitlementPlanId: { type: "string" },
    id: { type: "string" },
    provider: { enum: [...billingProviders], type: "string" },
    status: {
      enum: [...billingStatuses],
      type: "string"
    },
    updatedAt: { format: "date-time", type: "string" }
  },
  required: [
    "id",
    "billingPlanId",
    "entitlementPlanId",
    "provider",
    "status",
    "cancelAtPeriodEnd",
    "createdAt",
    "updatedAt"
  ],
  type: "object"
} as const;

const supportOrganizationListItemSchema = {
  additionalProperties: false,
  properties: {
    createdAt: { format: "date-time", type: "string" },
    id: { type: "string" },
    memberCount: { minimum: 0, type: "integer" },
    name: { type: "string" },
    ownerEmails: { items: { type: "string" }, type: "array" }
  },
  required: ["id", "name", "createdAt", "memberCount", "ownerEmails"],
  type: "object"
} as const;

const supportOrganizationDetailSchema = {
  additionalProperties: false,
  properties: {
    adminEmails: { items: { type: "string" }, type: "array" },
    billing: {
      additionalProperties: false,
      properties: {
        customer: {
          anyOf: [safeBillingCustomerSchema, { type: "null" }]
        },
        subscription: {
          anyOf: [safeBillingSubscriptionSchema, { type: "null" }]
        }
      },
      required: ["customer", "subscription"],
      type: "object"
    },
    createdAt: { format: "date-time", type: "string" },
    entitlement: supportEntitlementSummarySchema,
    id: { type: "string" },
    memberCount: { minimum: 0, type: "integer" },
    name: { type: "string" },
    ownerEmails: { items: { type: "string" }, type: "array" }
  },
  required: [
    "id",
    "name",
    "createdAt",
    "memberCount",
    "ownerEmails",
    "adminEmails",
    "billing",
    "entitlement"
  ],
  type: "object"
} as const;

export interface PlatformSupportRoutesOptions {
  service: PlatformSupportService;
}

export async function registerPlatformSupportRoutes(
  app: FastifyInstance,
  options: PlatformSupportRoutesOptions
) {
  registerApiSchemas(app);

  app.get(
    "/support/organizations",
    {
      schema: {
        querystring: {
          additionalProperties: false,
          properties: {
            limit: { minimum: 1, type: "integer" },
            query: { minLength: 1, type: "string" }
          },
          required: ["query"],
          type: "object"
        },
        response: {
          200: {
            additionalProperties: false,
            properties: {
              organizations: {
                items: supportOrganizationListItemSchema,
                type: "array"
              }
            },
            required: ["organizations"],
            type: "object"
          },
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Searches organizations for internal support lookup",
        tags: ["support"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const query = supportSearchQuerySchema.safeParse(request.query);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!canPerformSupportLookup(user)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      if (!query.success) {
        return reply.code(400).send({ error: "invalid_support_lookup_request" });
      }

      try {
        return {
          organizations: await options.service.searchOrganizations({
            limit: query.data.limit,
            query: query.data.query
          })
        };
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_support_query") {
          return reply.code(400).send({ error: "invalid_support_lookup_request" });
        }

        throw error;
      }
    }
  );

  app.get(
    "/support/organizations/:organizationId",
    {
      schema: {
        response: {
          200: {
            additionalProperties: false,
            properties: {
              organization: supportOrganizationDetailSchema
            },
            required: ["organization"],
            type: "object"
          },
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          404: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Returns a safe support summary for one organization",
        tags: ["support"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = supportOrganizationParamsSchema.safeParse(request.params);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!canPerformSupportLookup(user)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_support_lookup_request" });
      }

      try {
        return {
          organization: await options.service.getOrganizationDetail(
            params.data.organizationId
          )
        };
      } catch (error) {
        if (error instanceof Error && error.message === "organization_not_found") {
          return reply.code(404).send({ error: "organization_not_found" });
        }

        throw error;
      }
    }
  );
}

function getSessionUser(request: { sessionUser?: AuthUser }) {
  return request.sessionUser;
}
