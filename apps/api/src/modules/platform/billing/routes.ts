import type { FastifyInstance, FastifyReply } from "fastify";
import { billingProviders, billingStatuses } from "@auditrail/domain/billing";
import { z } from "zod";

import { registerApiSchemas, schemaIds } from "../../../http-schemas.js";
import type { AuthUser } from "../../auth/service.js";
import {
  BillingCustomerNotFoundError,
  BillingProviderNotConfiguredError
} from "./errors.js";
import {
  type PlatformBillingService
} from "./service.js";

const organizationParamsSchema = z.object({
  organizationId: z.string().min(1)
});

const checkoutBodySchema = z.object({
  cancelUrl: z.url(),
  planId: z.string().trim().min(1),
  priceId: z.string().trim().min(1).optional(),
  successUrl: z.url()
});

const portalBodySchema = z.object({
  returnUrl: z.url()
});

const billingStatusResponseSchema = {
  additionalProperties: false,
  properties: {
    customer: {
      anyOf: [
        {
          additionalProperties: false,
          properties: {
            createdAt: { format: "date-time", type: "string" },
            id: { type: "string" },
            provider: { enum: [...billingProviders], type: "string" },
            providerCustomerId: { type: "string" },
            updatedAt: { format: "date-time", type: "string" }
          },
          required: [
            "id",
            "provider",
            "providerCustomerId",
            "createdAt",
            "updatedAt"
          ],
          type: "object"
        },
        { type: "null" }
      ]
    },
    organizationId: { type: "string" },
    providerConfigurationStatus: {
      enum: ["configured", "not_configured"],
      type: "string"
    },
    subscription: {
      anyOf: [
        {
          additionalProperties: false,
          properties: {
            billingCustomerId: { type: "string" },
            billingPlanId: { type: "string" },
            cancelAtPeriodEnd: { type: "boolean" },
            createdAt: { format: "date-time", type: "string" },
            currentPeriodEnd: { format: "date-time", type: "string" },
            currentPeriodStart: { format: "date-time", type: "string" },
            entitlementPlanId: { type: "string" },
            id: { type: "string" },
            provider: { enum: [...billingProviders], type: "string" },
            providerPriceId: { type: "string" },
            providerProductId: { type: "string" },
            providerSubscriptionId: { type: "string" },
            status: {
              enum: [...billingStatuses],
              type: "string"
            },
            updatedAt: { format: "date-time", type: "string" }
          },
          required: [
            "id",
            "billingCustomerId",
            "billingPlanId",
            "entitlementPlanId",
            "provider",
            "providerSubscriptionId",
            "providerPriceId",
            "status",
            "cancelAtPeriodEnd",
            "createdAt",
            "updatedAt"
          ],
          type: "object"
        },
        { type: "null" }
      ]
    }
  },
  required: [
    "organizationId",
    "providerConfigurationStatus",
    "customer",
    "subscription"
  ],
  type: "object"
} as const;

const billingSessionLinkResponseSchema = {
  additionalProperties: false,
  properties: {
    provider: {
      enum: [...billingProviders],
      type: "string"
    },
    url: {
      format: "uri",
      type: "string"
    }
  },
  required: ["provider", "url"],
  type: "object"
} as const;

export interface PlatformBillingRoutesOptions {
  service: PlatformBillingService;
}

export async function registerPlatformBillingRoutes(
  app: FastifyInstance,
  options: PlatformBillingRoutesOptions
) {
  registerApiSchemas(app);

  app.get(
    "/organizations/:organizationId/billing",
    {
      schema: {
        response: {
          200: billingStatusResponseSchema,
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Returns billing status for an organization",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = organizationParamsSchema.safeParse(request.params);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_billing_request" });
      }

      try {
        return await options.service.getBillingStatusForUser({
          organizationId: params.data.organizationId,
          userId: user.id
        });
      } catch (error) {
        return mapBillingError(reply, error);
      }
    }
  );

  app.post(
    "/organizations/:organizationId/billing/checkout",
    {
      attachValidation: true,
      schema: {
        body: {
          additionalProperties: false,
          properties: {
            cancelUrl: { format: "uri", type: "string" },
            planId: { minLength: 1, type: "string" },
            priceId: { minLength: 1, type: "string" },
            successUrl: { format: "uri", type: "string" }
          },
          required: ["planId", "successUrl", "cancelUrl"],
          type: "object"
        },
        response: {
          200: billingSessionLinkResponseSchema,
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          501: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Creates a billing checkout intent for an organization",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = organizationParamsSchema.safeParse(request.params);
      const body = checkoutBodySchema.safeParse(request.body);
      const validationError =
        "validationError" in request ? request.validationError : undefined;

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (validationError || !params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_billing_request" });
      }

      try {
        return await options.service.createCheckoutIntentForUser({
          cancelUrl: body.data.cancelUrl,
          organizationId: params.data.organizationId,
          planId: body.data.planId,
          priceId: body.data.priceId,
          successUrl: body.data.successUrl,
          userEmail: user.email,
          userId: user.id
        });
      } catch (error) {
        return mapBillingError(reply, error);
      }
    }
  );

  app.post(
    "/organizations/:organizationId/billing/portal",
    {
      attachValidation: true,
      schema: {
        body: {
          additionalProperties: false,
          properties: {
            returnUrl: { format: "uri", type: "string" }
          },
          required: ["returnUrl"],
          type: "object"
        },
        response: {
          200: billingSessionLinkResponseSchema,
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          409: { $ref: `${schemaIds.simpleErrorResponse}#` },
          501: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Creates a billing portal intent for an organization",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = organizationParamsSchema.safeParse(request.params);
      const body = portalBodySchema.safeParse(request.body);
      const validationError =
        "validationError" in request ? request.validationError : undefined;

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (validationError || !params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_billing_request" });
      }

      try {
        return await options.service.createPortalIntentForUser({
          organizationId: params.data.organizationId,
          returnUrl: body.data.returnUrl,
          userId: user.id
        });
      } catch (error) {
        return mapBillingError(reply, error);
      }
    }
  );
}

function getSessionUser(request: { sessionUser?: AuthUser }) {
  return request.sessionUser;
}

function mapBillingError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error && error.message === "forbidden") {
    return reply.code(403).send({ error: "forbidden" });
  }

  if (
    error instanceof BillingCustomerNotFoundError ||
    (error instanceof Error && error.message === "billing_customer_not_found")
  ) {
    return reply.code(409).send({ error: "billing_customer_not_found" });
  }

  if (
    error instanceof BillingProviderNotConfiguredError ||
    (error instanceof Error &&
      error.message.startsWith("billing_provider_not_configured:"))
  ) {
    return reply.code(501).send({ error: "billing_provider_not_configured" });
  }

  throw error;
}
