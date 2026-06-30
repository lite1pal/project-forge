import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getRequestPrincipal } from "../api-keys/request-principal.js";
import { registerApiErrorHandler } from "../../http-errors.js";
import { registerApiSchemas } from "../../http-schemas.js";
import { createPostgresPlatformRepo } from "../platform/postgres-repo.js";
import { createPlatformEntitlementService } from "../platform/entitlements/service.js";
import {
  ingestEventRouteSchema,
  listEventsRouteSchema,
  summarizeEventsRouteSchema,
  timeseriesEventsRouteSchema
} from "./http-contract.js";
import { createPostgresAuditEventRepo } from "./postgres-repo.js";
import {
  assertValidCursor,
  listEventsQuerySchema,
  normalizeIngestInput,
  summarizeEventsQuerySchema,
  timeseriesEventsQuerySchema,
  toListFilters,
  toSummaryFilters,
  toTimeseriesFilters
} from "./query.js";
import {
  toAcceptedResponse,
  toEventListResponse,
  toEventStatsResponse,
  toEventTimeseriesResponse
} from "./presenters.js";
import { createInMemoryAuditEventRepo } from "./repo.js";
import {
  createAuditEventService,
  EventQuotaExceededError,
  type AuditEventService
} from "./service.js";

export interface EventRoutesOptions {
  productAccess?: {
    assertProductInstalledForOrganization(input: {
      organizationId: string;
      productId: string;
    }): Promise<void>;
  };
  productId?: string;
  projectAccess?: {
    resolveTenantForUser(input: {
      organizationId: string;
      projectId: string;
      userId: string;
    }): Promise<{
      organizationId: string;
      projectId: string;
    }>;
  };
  service?: AuditEventService;
}

const projectRouteParamsSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1)
});

export async function registerEventRoutes(
  app: FastifyInstance,
  options: EventRoutesOptions = {}
) {
  registerApiErrorHandler(app);
  registerApiSchemas(app);

  const service =
    options.service ??
    createAuditEventService(
      "db" in app
        ? createPostgresAuditEventRepo(app.db)
        : createInMemoryAuditEventRepo(),
      "db" in app
        ? {
            entitlementService: createPlatformEntitlementService(
              createPostgresPlatformRepo(app.db)
            )
          }
        : {}
    );

  app.post(
    "/events",
    {
      schema: ingestEventRouteSchema
    },
    async (request, reply) => {
      try {
        const principal = getRequestPrincipal(request);
        await assertProductInstalled(options, principal.organizationId);
        const event = await service.ingest(
          {
            organizationId: principal.organizationId,
            projectId: principal.projectId
          },
          normalizeIngestInput(request.body as NormalizableRequestBody)
        );

        return reply.code(202).send(toAcceptedResponse(event));
      } catch (error) {
        if (error instanceof EventQuotaExceededError) {
          return reply.code(402).send({
            error: "event_quota_exceeded",
            plan: error.plan
          });
        }

        throw error;
      }
    }
  );

  app.get(
    "/events",
    {
      schema: listEventsRouteSchema
    },
    async (request, reply) => {
      try {
        const principal = getRequestPrincipal(request);
        await assertProductInstalled(options, principal.organizationId);
        const query = listEventsQuerySchema.parse(request.query);

        assertValidCursor(query.cursor);

        const events = await service.list(
          {
            organizationId: principal.organizationId,
            projectId: principal.projectId
          },
          toListFilters(query)
        );

        return reply.send(toEventListResponse(events, query.limit));
      } catch (error) {
        if (error instanceof Error && error.message === "invalid cursor") {
          return reply.code(400).send({
            error: "invalid_event_query",
            issues: []
          });
        }

        throw error;
      }
    }
  );

  app.get(
    "/events/stats",
    {
      schema: summarizeEventsRouteSchema
    },
    async (request, reply) => {
      const principal = getRequestPrincipal(request);
      await assertProductInstalled(options, principal.organizationId);
      const query = summarizeEventsQuerySchema.parse(request.query);
      const summary = await service.summarize(
        {
          organizationId: principal.organizationId,
          projectId: principal.projectId
        },
        toSummaryFilters(query)
      );

      return reply.send(toEventStatsResponse(summary));
    }
  );

  app.get(
    "/events/timeseries",
    {
      schema: timeseriesEventsRouteSchema
    },
    async (request, reply) => {
      const principal = getRequestPrincipal(request);
      await assertProductInstalled(options, principal.organizationId);
      const query = timeseriesEventsQuerySchema.parse(request.query);
      const points = await service.timeseries(
        {
          organizationId: principal.organizationId,
          projectId: principal.projectId
        },
        toTimeseriesFilters(query)
      );

      return reply.send(toEventTimeseriesResponse(points));
    }
  );

  if (!options.projectAccess) {
    return;
  }

  const projectAccess = options.projectAccess;

  app.get(
    "/organizations/:organizationId/projects/:projectId/events",
    async (request, reply) => {
      try {
        const user = request.sessionUser;

        if (!user) {
          return reply.code(401).send({ error: "missing_session" });
        }

        const params = projectRouteParamsSchema.parse(request.params);
        await assertProductInstalled(options, params.organizationId);
        const query = listEventsQuerySchema.parse(request.query);

        assertValidCursor(query.cursor);

        const tenant = await projectAccess.resolveTenantForUser({
          organizationId: params.organizationId,
          projectId: params.projectId,
          userId: user.id
        });
        const events = await service.list(tenant, toListFilters(query));

        return reply.send(toEventListResponse(events, query.limit));
      } catch (error) {
        if (error instanceof Error && error.message === "invalid cursor") {
          return reply.code(400).send({
            error: "invalid_event_query",
            issues: []
          });
        }

        return handleProjectAccessError(reply, error);
      }
    }
  );

  app.get(
    "/organizations/:organizationId/projects/:projectId/events/stats",
    async (request, reply) => {
      const user = request.sessionUser;

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      try {
        const params = projectRouteParamsSchema.parse(request.params);
        await assertProductInstalled(options, params.organizationId);
        const query = summarizeEventsQuerySchema.parse(request.query);
        const tenant = await projectAccess.resolveTenantForUser({
          organizationId: params.organizationId,
          projectId: params.projectId,
          userId: user.id
        });
        const summary = await service.summarize(tenant, toSummaryFilters(query));

        return reply.send(toEventStatsResponse(summary));
      } catch (error) {
        return handleProjectAccessError(reply, error);
      }
    }
  );

  app.get(
    "/organizations/:organizationId/projects/:projectId/events/timeseries",
    async (request, reply) => {
      const user = request.sessionUser;

      if (!user) {
        return reply.code(401).send({ error: "missing_session" });
      }

      try {
        const params = projectRouteParamsSchema.parse(request.params);
        await assertProductInstalled(options, params.organizationId);
        const query = timeseriesEventsQuerySchema.parse(request.query);
        const tenant = await projectAccess.resolveTenantForUser({
          organizationId: params.organizationId,
          projectId: params.projectId,
          userId: user.id
        });
        const points = await service.timeseries(tenant, toTimeseriesFilters(query));

        return reply.send(toEventTimeseriesResponse(points));
      } catch (error) {
        return handleProjectAccessError(reply, error);
      }
    }
  );
}

type NormalizableRequestBody = {
  event: string;
  actor?: string;
  target?: string;
  metadata?: Record<string, unknown>;
};

function handleProjectAccessError(
  reply: {
    code(statusCode: number): {
      send(payload: unknown): unknown;
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

  if (error instanceof Error && error.message === "product_not_installed") {
    return reply.code(404).send({ error: "product_not_installed" });
  }

  throw error;
}

async function assertProductInstalled(
  options: EventRoutesOptions,
  organizationId: string
) {
  if (!options.productAccess || !options.productId) {
    return;
  }

  await options.productAccess.assertProductInstalledForOrganization({
    organizationId,
    productId: options.productId
  });
}
