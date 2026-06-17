import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthUser } from "../auth/service.js";
import type { ExportService } from "./service.js";
import type { ExportObjectStorage } from "./storage.js";

const exportFiltersBodySchema = z.object({
  filters: z
    .object({
      actor: z.string().optional(),
      event: z.string().optional(),
      from: z.string().optional(),
      target: z.string().optional(),
      to: z.string().optional()
    })
    .default({})
});

const exportParamsSchema = z.object({
  exportId: z.string().min(1).optional(),
  projectId: z.string().min(1)
});

export interface ExportRoutesOptions {
  organizationId: string;
  service: ExportService;
  storage: ExportObjectStorage;
}

export async function registerExportRoutes(
  app: FastifyInstance,
  options: ExportRoutesOptions
) {
  app.post("/projects/:projectId/exports", async (request, reply) => {
    const user = getSessionUser(request);
    const params = exportParamsSchema.parse(request.params);
    const body = exportFiltersBodySchema.safeParse(request.body ?? {});

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_export_request" });
    }

    const job = await options.service.createExport({
      filters: body.data.filters,
      organizationId: options.organizationId,
      projectId: params.projectId,
      requestedByUserId: user.id
    });

    return reply.code(202).send({ export: job });
  });

  app.get("/projects/:projectId/exports", async (request, reply) => {
    const user = getSessionUser(request);
    const params = exportParamsSchema.parse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    return {
      exports: await options.service.listExports({
        organizationId: options.organizationId,
        projectId: params.projectId
      })
    };
  });

  app.get("/projects/:projectId/exports/:exportId", async (request, reply) => {
    const user = getSessionUser(request);
    const params = exportParamsSchema.parse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    const job = await options.service.getExport({
      exportId: params.exportId ?? "",
      organizationId: options.organizationId,
      projectId: params.projectId
    });

    if (!job) {
      return reply.code(404).send({ error: "export_not_found" });
    }

    if (job.status !== "completed" || !job.objectKey) {
      return { export: job };
    }

    return {
      downloadUrl: await options.storage.getSignedDownloadUrl({
        expiresInSeconds: 300,
        key: job.objectKey
      }),
      export: job
    };
  });
}

function getSessionUser(request: { sessionUser?: AuthUser }) {
  return request.sessionUser;
}
