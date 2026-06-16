import { ingestAuditEventSchema } from "@auditrail/domain/audit-events";
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";

import { createInMemoryAuditEventRepo } from "./repo.js";
import { createPostgresAuditEventRepo } from "./postgres-repo.js";
import {
  createAuditEventService,
  type AuditEventService
} from "./service.js";

export interface EventRoutesOptions {
  service?: AuditEventService;
}

const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export async function registerEventRoutes(
  app: FastifyInstance,
  options: EventRoutesOptions = {}
) {
  const service =
    options.service ??
    createAuditEventService(
      "db" in app
        ? createPostgresAuditEventRepo(app.db)
        : createInMemoryAuditEventRepo()
    );

  app.post("/events", async (request, reply) => {
    try {
      const principal = request.apiKeyPrincipal ?? {
        organizationId: "00000000-0000-0000-0000-000000000000",
        projectId: "00000000-0000-0000-0000-000000000000"
      };
      const input = ingestAuditEventSchema.parse(request.body);
      const event = await service.ingest(
        {
          organizationId: principal.organizationId,
          projectId: principal.projectId
        },
        input
      );

      return reply.code(202).send({
        id: event.id,
        event: event.eventType,
        accepted: true
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "invalid_event_payload",
          issues: error.issues
        });
      }

      throw error;
    }
  });

  app.get("/events", async (request, reply) => {
    try {
      const principal = request.apiKeyPrincipal ?? {
        organizationId: "00000000-0000-0000-0000-000000000000",
        projectId: "00000000-0000-0000-0000-000000000000"
      };
      const query = listEventsQuerySchema.parse(request.query);
      const events = await service.listRecent(
        {
          organizationId: principal.organizationId,
          projectId: principal.projectId
        },
        query.limit
      );

      return reply.send({
        events: events.map((event) => ({
          id: event.id,
          event: event.eventType,
          actor: event.actorId,
          target: event.targetId,
          metadata: event.metadata
        }))
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "invalid_event_query",
          issues: error.issues
        });
      }

      throw error;
    }
  });
}
