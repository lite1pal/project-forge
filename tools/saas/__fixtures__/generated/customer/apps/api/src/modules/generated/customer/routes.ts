import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { createCustomerService } from "./service.js";

const organizationParamsSchema = z.object({
  organizationId: z.string().uuid()
});

const resourceIdParamsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid()
});

export async function registerCustomerRoutes(
  app: FastifyInstance,
  options: { service: ReturnType<typeof createCustomerService> }
) {
  app.get("/v1/organizations/:organizationId/customers", async (request, reply) => {
    const params = organizationParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return options.service.list({
      cursor: undefined,
      limit: undefined,
      organizationId: params.data.organizationId,
      query: undefined
    });
  });

  app.post("/v1/organizations/:organizationId/customers", async (request, reply) => {
    const params = organizationParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return options.service.create({
      data: request.body as Record<string, unknown>,
      organizationId: params.data.organizationId
    });
  });

  app.get("/v1/organizations/:organizationId/customers/:id", async (request, reply) => {
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const resource = await options.service.get({
      id: params.data.id,
      organizationId: params.data.organizationId
    });

    if (!resource) {
      return reply.code(404).send({ error: "not_found" });
    }

    return resource;
  });

  app.patch("/v1/organizations/:organizationId/customers/:id", async (request, reply) => {
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const resource = await options.service.update({
      data: request.body as Record<string, unknown>,
      id: params.data.id,
      organizationId: params.data.organizationId
    });

    if (!resource) {
      return reply.code(404).send({ error: "not_found" });
    }

    return resource;
  });
}
