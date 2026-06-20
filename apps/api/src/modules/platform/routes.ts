import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { registerApiSchemas } from "../../http-schemas.js";
import type { AuthUser } from "../auth/service.js";
import type { PlatformService } from "./service.js";

const createOrganizationBodySchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const createInvitationBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"])
});

const acceptInvitationBodySchema = z.object({
  token: z.string().min(1)
});

export interface PlatformRoutesOptions {
  service: PlatformService;
  invitationTokenSecret?: string;
  invitationTtlMs?: number;
}

export async function registerPlatformRoutes(
  app: FastifyInstance,
  options: PlatformRoutesOptions
) {
  registerApiSchemas(app);

  app.get("/organizations", async (request, reply) => {
    const user = getSessionUser(request);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    return {
      organizations: await options.service.listOrganizationsForUser(user.id)
    };
  });

  app.post("/organizations", async (request, reply) => {
    const user = getSessionUser(request);
    const body = createOrganizationBodySchema.safeParse(request.body);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_organization_request" });
    }

    const result = await options.service.createOrganization({
      name: body.data.name,
      ownerUserId: user.id
    });

    return reply.code(201).send(result);
  });

  app.get("/organizations/:organizationId/projects", async (request, reply) => {
    const user = getSessionUser(request);
    const params = z
      .object({
        organizationId: z.string().min(1)
      })
      .parse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    try {
      return {
        projects: await options.service.listProjectsForUser({
          organizationId: params.organizationId,
          userId: user.id
        })
      };
    } catch (error) {
      if (error instanceof Error && error.message === "forbidden") {
        return reply.code(403).send({ error: "forbidden" });
      }

      if (error instanceof Error && error.message === "duplicate_invitation") {
        return reply.code(409).send({ error: "duplicate_invitation" });
      }

      throw error;
    }
  });

  app.get("/organizations/:organizationId/members", async (request, reply) => {
    const user = getSessionUser(request);
    const params = z
      .object({
        organizationId: z.string().min(1)
      })
      .parse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    try {
      return {
        members: await options.service.listOrganizationMembersForUser({
          organizationId: params.organizationId,
          userId: user.id
        })
      };
    } catch (error) {
      if (error instanceof Error && error.message === "forbidden") {
        return reply.code(403).send({ error: "forbidden" });
      }

      throw error;
    }
  });

  app.post("/organizations/:organizationId/projects", async (request, reply) => {
    const user = getSessionUser(request);
    const params = z
      .object({
        organizationId: z.string().min(1)
      })
      .parse(request.params);
    const body = createProjectBodySchema.safeParse(request.body);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_project_request" });
    }

    try {
      const project = await options.service.createProjectForUser({
        name: body.data.name,
        organizationId: params.organizationId,
        userId: user.id
      });

      return reply.code(201).send({ project });
    } catch (error) {
      if (error instanceof Error && error.message === "forbidden") {
        return reply.code(403).send({ error: "forbidden" });
      }

      throw error;
    }
  });

  app.post("/organizations/:organizationId/invitations", async (request, reply) => {
    const user = getSessionUser(request);
    const params = z
      .object({
        organizationId: z.string().min(1)
      })
      .parse(request.params);
    const body = createInvitationBodySchema.safeParse(request.body);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_invitation_request" });
    }

    try {
      const result = await options.service.inviteMember({
        email: body.data.email,
        organizationId: params.organizationId,
        role: body.data.role,
        tokenSecret: options.invitationTokenSecret ?? "test-invitation-secret",
        ttlMs: options.invitationTtlMs ?? 1000 * 60 * 60 * 24 * 7,
        userId: user.id
      });

      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof Error && error.message === "forbidden") {
        return reply.code(403).send({ error: "forbidden" });
      }

      throw error;
    }
  });

  app.post("/invitations/accept", async (request, reply) => {
    const user = getSessionUser(request);
    const body = acceptInvitationBodySchema.safeParse(request.body);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_invitation_request" });
    }

    try {
      const membership = await options.service.acceptInvitation({
        token: body.data.token,
        tokenSecret: options.invitationTokenSecret ?? "test-invitation-secret",
        userEmail: user.email,
        userId: user.id
      });

      return reply.code(201).send({ membership });
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_invitation") {
        return reply.code(401).send({ error: "invalid_invitation" });
      }

      throw error;
    }
  });

  app.post("/invitations/:invitationId/revoke", async (request, reply) => {
    const user = getSessionUser(request);
    const params = z
      .object({
        invitationId: z.string().min(1)
      })
      .parse(request.params);
    const body = z
      .object({
        organizationId: z.string().min(1)
      })
      .safeParse(request.body);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_invitation_request" });
    }

    try {
      await options.service.revokeInvitation({
        invitationId: params.invitationId,
        organizationId: body.data.organizationId,
        userId: user.id
      });

      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === "forbidden") {
        return reply.code(403).send({ error: "forbidden" });
      }

      throw error;
    }
  });
}

function getSessionUser(request: { sessionUser?: AuthUser }) {
  return request.sessionUser;
}
