import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerExportRoutes } from "../routes.js";
import type { ExportService } from "../service.js";
import { createInMemoryExportObjectStorage } from "../storage.js";

describe("registerExportRoutes", () => {
  it("creates export jobs for the current user", async () => {
    const app = buildTestApp({
      async createExport(input) {
        expect(input).toMatchObject({
          organizationId: "org-1",
          projectId: "project-1",
          requestedByUserId: "user-1"
        });

        return {
          filters: {},
          id: "export-1",
          organizationId: "org-1",
          projectId: "project-1",
          requestedByUserId: "user-1",
          status: "pending"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        filters: {
          event: "user.created"
        }
      },
      url: "/projects/project-1/exports"
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().export.id).toBe("export-1");
  });

  it("lists export jobs", async () => {
    const app = buildTestApp({
      async listExports() {
        return [
          {
            filters: {},
            id: "export-1",
            organizationId: "org-1",
            projectId: "project-1",
            requestedByUserId: "user-1",
            status: "pending"
          }
        ];
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/projects/project-1/exports"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().exports).toHaveLength(1);
  });

  it("returns signed download URLs for completed exports", async () => {
    const app = buildTestApp({
      async getExport() {
        return {
          filters: {},
          id: "export-1",
          objectKey: "exports/export-1.csv",
          organizationId: "org-1",
          projectId: "project-1",
          requestedByUserId: "user-1",
          status: "completed"
        };
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/projects/project-1/exports/export-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().downloadUrl).toBe(
      "memory://exports/export-1.csv?expires=300"
    );
  });

  it("returns 404 for missing exports", async () => {
    const app = buildTestApp({
      async getExport() {
        return undefined;
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/projects/project-1/exports/missing"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "export_not_found" });
  });

  it("requires sessions", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "GET",
      url: "/projects/project-1/exports"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });
});

function buildTestApp(
  overrides: Partial<ExportService>,
  options: { session?: boolean } = {}
) {
  const app = Fastify();
  app.decorateRequest("sessionUser");
  app.addHook("preHandler", async (request) => {
    if (options.session === false) {
      return;
    }

    request.sessionUser = {
      email: "user@example.com",
      id: "user-1"
    };
  });
  app.register(registerExportRoutes, {
    organizationId: "org-1",
    service: createExportServiceStub(overrides),
    storage: createInMemoryExportObjectStorage()
  });

  return app;
}

function createExportServiceStub(overrides: Partial<ExportService>): ExportService {
  return {
    async createExport() {
      throw new Error("not implemented");
    },
    async getExport() {
      return undefined;
    },
    async listExports() {
      return [];
    },
    ...overrides
  };
}
