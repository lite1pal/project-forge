import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { registerApiSchemas, schemaIds } from "../../http-schemas.js";
import type { AuthUser } from "../auth/service.js";
import type { ApiKeyService } from "./service.js";

const paramsSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1)
});

const revokeParamsSchema = paramsSchema.extend({
  apiKeyId: z.string().min(1)
});

const createApiKeyBodySchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export interface ApiKeyRoutesOptions {
  service: ApiKeyService;
}

export async function registerApiKeyRoutes(
  app: FastifyInstance,
  options: ApiKeyRoutesOptions
) {
  registerApiSchemas(app);

  app.get(
    "/organizations/:organizationId/projects/:projectId/api-keys",
    {
      schema: {
        response: {
          200: {
            additionalProperties: false,
            properties: {
              apiKeys: {
                items: {
                  $ref: `${schemaIds.managedApiKeyResponse}#`
                },
                type: "array"
              }
            },
            required: ["apiKeys"],
            type: "object"
          },
          400: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          401: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          403: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          404: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          }
        },
        summary: "Lists API keys for a project",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = paramsSchema.safeParse(request.params);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_api_key_request" });
      }

      try {
        return {
          apiKeys: await options.service.listApiKeysForUser({
            organizationId: params.data.organizationId,
            projectId: params.data.projectId,
            userId: user.id
          })
        };
      } catch (error) {
        return mapApiKeyError(reply, error);
      }
    }
  );

  app.post(
    "/organizations/:organizationId/projects/:projectId/api-keys",
    {
      schema: {
        body: {
          $ref: `${schemaIds.createApiKeyBody}#`
        },
        response: {
          201: {
            additionalProperties: false,
            properties: {
              apiKey: {
                $ref: `${schemaIds.managedApiKeyResponse}#`
              },
              rawKey: {
                type: "string"
              }
            },
            required: ["apiKey", "rawKey"],
            type: "object"
          },
          400: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          401: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          403: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          404: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          }
        },
        summary: "Creates an API key for a project",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = paramsSchema.safeParse(request.params);
      const body = createApiKeyBodySchema.safeParse(request.body);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_api_key_request" });
      }

      try {
        const result = await options.service.createApiKeyForUser({
          name: body.data.name,
          organizationId: params.data.organizationId,
          projectId: params.data.projectId,
          userId: user.id
        });

        return reply.code(201).send(result);
      } catch (error) {
        return mapApiKeyError(reply, error);
      }
    }
  );

  app.post(
    "/organizations/:organizationId/projects/:projectId/api-keys/:apiKeyId/revoke",
    {
      schema: {
        response: {
          204: {
            type: "null"
          },
          400: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          401: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          403: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          },
          404: {
            $ref: `${schemaIds.simpleErrorResponse}#`
          }
        },
        summary: "Revokes an API key for a project",
        tags: ["platform"]
      }
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const params = revokeParamsSchema.safeParse(request.params);

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_api_key_request" });
      }

      try {
        await options.service.revokeApiKeyForUser({
          apiKeyId: params.data.apiKeyId,
          organizationId: params.data.organizationId,
          projectId: params.data.projectId,
          userId: user.id
        });

        return reply.code(204).send();
      } catch (error) {
        return mapApiKeyError(reply, error);
      }
    }
  );
}

function getSessionUser(request: { sessionUser?: AuthUser }) {
  return request.sessionUser;
}

function mapApiKeyError(
  reply: FastifyReply,
  error: unknown
) {
  if (error instanceof Error && error.message === "forbidden") {
    return reply.code(403).send({ error: "forbidden" });
  }

  if (
    error instanceof Error &&
    (error.message === "project_not_found" || error.message === "api_key_not_found")
  ) {
    return reply.code(404).send({ error: error.message });
  }

  throw error;
}
