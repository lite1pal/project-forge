import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerCustomerRoutes } from "../routes.js";

describe("registerCustomerRoutes", () => {
  it("lists customers for the current organization", async () => {
    const app = Fastify();

    await registerCustomerRoutes(app, {
      service: {
        async create() {
          throw new Error("not used");
        },
        async get() {
          throw new Error("not used");
        },
        async list() {
          return [];
        },
        async update() {
          throw new Error("not used");
        }
      }
    });

    const response = await app.inject({
      url: "/v1/organizations/:organizationId/customers"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
