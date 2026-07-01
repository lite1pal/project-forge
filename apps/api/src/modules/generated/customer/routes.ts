import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import type { createCustomerService } from "./service.js";

const organizationParamsSchema = z.object({
  organizationId: z.string().uuid()
});

const resourceIdParamsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid()
});

type GeneratedResourceAccessRole = "owner" | "admin" | "member" | "viewer";

export interface CustomerRoutesOptions {
  access: {
    assertOrganizationAccess(input: {
      allowedRoles: readonly GeneratedResourceAccessRole[];
      organizationId: string;
      userId: string;
    }): Promise<void>;
  };
  service: ReturnType<typeof createCustomerService>;
}

export async function registerCustomerRoutes(
  app: FastifyInstance,
  options: CustomerRoutesOptions
) {
  app.get("/v1/organizations/:organizationId/customers", async (request, reply) => {
    const user = request.sessionUser;
    const params = organizationParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      await options.access.assertOrganizationAccess({
        allowedRoles: ["owner", "admin", "member", "viewer"],
        organizationId: params.data.organizationId,
        userId: user.id
      });

      return {
        items: await options.service.list({
          cursor: undefined,
          limit: undefined,
          organizationId: params.data.organizationId,
          query: undefined
        })
      };
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.post("/v1/organizations/:organizationId/customers", async (request, reply) => {
    const user = request.sessionUser;
    const params = organizationParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      await options.access.assertOrganizationAccess({
        allowedRoles: ["owner", "admin", "member"],
        organizationId: params.data.organizationId,
        userId: user.id
      });

      return reply.code(201).send(
        await options.service.create({
          data: request.body as Parameters<typeof options.service.create>[0]["data"],
          organizationId: params.data.organizationId
        })
      );
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.get("/v1/organizations/:organizationId/customers/:id", async (request, reply) => {
    const user = request.sessionUser;
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      await options.access.assertOrganizationAccess({
        allowedRoles: ["owner", "admin", "member", "viewer"],
        organizationId: params.data.organizationId,
        userId: user.id
      });

      const resource = await options.service.get({
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!resource) {
        return reply.code(404).send({ error: "not_found" });
      }

      return resource;
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.patch("/v1/organizations/:organizationId/customers/:id", async (request, reply) => {
    const user = request.sessionUser;
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      await options.access.assertOrganizationAccess({
        allowedRoles: ["owner", "admin", "member"],
        organizationId: params.data.organizationId,
        userId: user.id
      });

      const resource = await options.service.update({
        data: request.body as Parameters<typeof options.service.update>[0]["data"],
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!resource) {
        return reply.code(404).send({ error: "not_found" });
      }

      return resource;
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });
}

function mapGeneratedResourceAccessError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error && error.message === "forbidden") {
    return reply.code(403).send({ error: "forbidden" });
  }

  throw error;
}
