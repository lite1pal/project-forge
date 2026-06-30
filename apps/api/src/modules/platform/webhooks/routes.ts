import type { FastifyInstance } from "fastify";
import {
  projectWebhookDeliveryStatuses,
  projectWebhookEventTypes
} from "@auditrail/domain";
import { z } from "zod";

import { registerApiSchemas, schemaIds } from "../../../http-schemas.js";
import type { AuthUser } from "../../auth/service.js";
import type { PlatformProjectWebhooksService } from "./service.js";

const projectParamsSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1)
});

const endpointParamsSchema = projectParamsSchema.extend({
  endpointId: z.string().min(1)
});

const createBodySchema = z.object({
  subscribedEventTypes: z.array(z.enum(projectWebhookEventTypes)).min(1),
  url: z.url()
});

const updateBodySchema = z.object({
  enabled: z.boolean().optional(),
  subscribedEventTypes: z.array(z.enum(projectWebhookEventTypes)).min(1).optional(),
  url: z.url().optional()
});

const deliveryResponseSchema = {
  additionalProperties: false,
  properties: {
    attemptCount: { type: "integer" },
    auditEventCreatedAt: { format: "date-time", type: "string" },
    auditEventId: { type: "string" },
    auditEventType: { type: "string" },
    createdAt: { format: "date-time", type: "string" },
    deliveredAt: { format: "date-time", type: "string" },
    endpointId: { type: "string" },
    id: { type: "string" },
    lastError: { type: "string" },
    maxAttempts: { type: "integer" },
    nextRetryAt: { format: "date-time", type: "string" },
    responseBodySummary: { type: "string" },
    responseStatusCode: { type: "integer" },
    status: { enum: [...projectWebhookDeliveryStatuses], type: "string" },
    updatedAt: { format: "date-time", type: "string" }
  },
  required: [
    "attemptCount",
    "auditEventCreatedAt",
    "auditEventId",
    "auditEventType",
    "createdAt",
    "endpointId",
    "id",
    "maxAttempts",
    "status",
    "updatedAt"
  ],
  type: "object"
} as const;

const endpointResponseSchema = {
  additionalProperties: false,
  properties: {
    createdAt: { format: "date-time", type: "string" },
    enabled: { type: "boolean" },
    id: { type: "string" },
    latestDelivery: {
      anyOf: [deliveryResponseSchema, { type: "null" }]
    },
    organizationId: { type: "string" },
    projectId: { type: "string" },
    subscribedEventTypes: {
      items: { enum: [...projectWebhookEventTypes], type: "string" },
      type: "array"
    },
    updatedAt: { format: "date-time", type: "string" },
    url: { format: "uri", type: "string" }
  },
  required: [
    "createdAt",
    "enabled",
    "id",
    "latestDelivery",
    "organizationId",
    "projectId",
    "subscribedEventTypes",
    "updatedAt",
    "url"
  ],
  type: "object"
} as const;

export interface PlatformProjectWebhookRoutesOptions {
  service: PlatformProjectWebhooksService;
}

export async function registerPlatformProjectWebhookRoutes(
  app: FastifyInstance,
  options: PlatformProjectWebhookRoutesOptions
) {
  registerApiSchemas(app);

  app.get(
    "/organizations/:organizationId/projects/:projectId/webhooks",
    {
      schema: {
        response: {
          200: {
            additionalProperties: false,
            properties: {
              endpoints: {
                items: endpointResponseSchema,
                type: "array"
              }
            },
            required: ["endpoints"],
            type: "object"
          },
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          404: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Lists project webhook endpoints",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = projectParamsSchema.safeParse(request.params);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_webhook_request" });
      }

      try {
        return {
          endpoints: (await options.service.listEndpointsForUser({
            organizationId: params.data.organizationId,
            projectId: params.data.projectId,
            userId: user.id
          })).map(withNullableLatestDelivery)
        };
      } catch (error) {
        return mapWebhookError(reply, error);
      }
    }
  );

  app.post(
    "/organizations/:organizationId/projects/:projectId/webhooks",
    {
      attachValidation: true,
      schema: {
        body: {
          additionalProperties: false,
          properties: {
            subscribedEventTypes: {
              items: { enum: [...projectWebhookEventTypes], type: "string" },
              minItems: 1,
              type: "array"
            },
            url: { format: "uri", type: "string" }
          },
          required: ["url", "subscribedEventTypes"],
          type: "object"
        },
        response: {
          201: {
            additionalProperties: false,
            properties: {
              endpoint: endpointResponseSchema,
              secret: { type: "string" }
            },
            required: ["endpoint", "secret"],
            type: "object"
          },
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          404: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Creates a project webhook endpoint",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = projectParamsSchema.safeParse(request.params);
      const body = createBodySchema.safeParse(request.body);
      const validationError =
        "validationError" in request ? request.validationError : undefined;

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (validationError || !params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_webhook_request" });
      }

      try {
        const result = await options.service.createEndpointForUser({
          organizationId: params.data.organizationId,
          projectId: params.data.projectId,
          subscribedEventTypes: body.data.subscribedEventTypes,
          url: body.data.url,
          userId: user.id
        });

        return reply.code(201).send({
          endpoint: withNullableLatestDelivery(result.endpoint),
          secret: result.secret
        });
      } catch (error) {
        return mapWebhookError(reply, error);
      }
    }
  );

  app.patch(
    "/organizations/:organizationId/projects/:projectId/webhooks/:endpointId",
    {
      attachValidation: true,
      schema: {
        body: {
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            subscribedEventTypes: {
              items: { enum: [...projectWebhookEventTypes], type: "string" },
              minItems: 1,
              type: "array"
            },
            url: { format: "uri", type: "string" }
          },
          type: "object"
        },
        response: {
          200: endpointResponseSchema,
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          404: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Updates a project webhook endpoint",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = endpointParamsSchema.safeParse(request.params);
      const body = updateBodySchema.safeParse(request.body);
      const validationError =
        "validationError" in request ? request.validationError : undefined;

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (validationError || !params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_webhook_request" });
      }

      try {
        return withNullableLatestDelivery(
          await options.service.updateEndpointForUser({
            enabled: body.data.enabled,
            endpointId: params.data.endpointId,
            organizationId: params.data.organizationId,
            projectId: params.data.projectId,
            subscribedEventTypes: body.data.subscribedEventTypes,
            url: body.data.url,
            userId: user.id
          })
        );
      } catch (error) {
        return mapWebhookError(reply, error);
      }
    }
  );

  app.post(
    "/organizations/:organizationId/projects/:projectId/webhooks/:endpointId/rotate-secret",
    {
      schema: {
        response: {
          200: {
            additionalProperties: false,
            properties: {
              endpoint: endpointResponseSchema,
              secret: { type: "string" }
            },
            required: ["endpoint", "secret"],
            type: "object"
          },
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          404: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Rotates a project webhook endpoint secret",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = endpointParamsSchema.safeParse(request.params);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_webhook_request" });
      }

      try {
        const result = await options.service.rotateSecretForUser({
          endpointId: params.data.endpointId,
          organizationId: params.data.organizationId,
          projectId: params.data.projectId,
          userId: user.id
        });

        return {
          endpoint: withNullableLatestDelivery(result.endpoint),
          secret: result.secret
        };
      } catch (error) {
        return mapWebhookError(reply, error);
      }
    }
  );

  app.delete(
    "/organizations/:organizationId/projects/:projectId/webhooks/:endpointId",
    {
      schema: {
        response: {
          204: {
            type: "null"
          },
          400: { $ref: `${schemaIds.simpleErrorResponse}#` },
          401: { $ref: `${schemaIds.simpleErrorResponse}#` },
          403: { $ref: `${schemaIds.simpleErrorResponse}#` },
          404: { $ref: `${schemaIds.simpleErrorResponse}#` }
        },
        summary: "Deletes a project webhook endpoint",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = endpointParamsSchema.safeParse(request.params);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_webhook_request" });
      }

      try {
        await options.service.deleteEndpointForUser({
          endpointId: params.data.endpointId,
          organizationId: params.data.organizationId,
          projectId: params.data.projectId,
          userId: user.id
        });

        return reply.code(204).send();
      } catch (error) {
        return mapWebhookError(reply, error);
      }
    }
  );
}

function getSessionUser(request: {
  sessionUser?: AuthUser;
}) {
  return request.sessionUser;
}

function mapWebhookError(
  reply: {
    code(statusCode: number): {
      send(payload?: unknown): unknown;
    };
  },
  error: unknown
) {
  if (error instanceof Error && error.message === "forbidden") {
    return reply.code(403).send({ error: "forbidden" });
  }

  if (error instanceof Error && error.message === "project_not_found") {
    return reply.code(404).send({ error: "project_not_found" });
  }

  if (error instanceof Error && error.message === "webhook_not_found") {
    return reply.code(404).send({ error: "webhook_not_found" });
  }

  if (error instanceof Error && error.message === "invalid_webhook_request") {
    return reply.code(400).send({ error: "invalid_webhook_request" });
  }

  throw error;
}

function withNullableLatestDelivery<T extends { latestDelivery?: unknown }>(input: T) {
  return {
    ...input,
    latestDelivery: input.latestDelivery ?? null
  };
}
