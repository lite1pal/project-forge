import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  getProductApiOpenApiInfo,
  registerProductApiRoutes
} from "../product-module.js";

describe("API product module", () => {
  it("derives OpenAPI info from the product module", () => {
    expect(getProductApiOpenApiInfo()).toEqual({
      description:
        "Versioned audit event ingestion and query API. The canonical contract is /api/v1.",
      title: "AuditTrail API"
    });
  });

  it("registers the declared product API routes", async () => {
    const app = Fastify();

    await app.register(registerProductApiRoutes, {
      prefix: "/api/v1"
    });

    const paths = app
      .printRoutes()
      .split("\n")
      .filter((line) => line.includes("api/v1/events"));

    expect(paths.length).toBeGreaterThan(0);

    await app.close();
  });
});
