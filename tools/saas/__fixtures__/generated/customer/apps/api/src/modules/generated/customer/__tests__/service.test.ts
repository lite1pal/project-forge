import { describe, expect, it } from "vitest";

import { createCustomerService } from "../service.js";

describe("createCustomerService", () => {
  it("validates create input before writing customer records", async () => {
    const service = createCustomerService({
      async create(input) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: input.organizationId,
          name: "name value",
          email: "person@example.com",
          isActive: true,
          status: "active",
          externalId: "00000000-0000-0000-0000-000000000001",
          lastContactedAt: "2026-06-29T00:00:00.000Z",
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        };
      },
      async findById() {
        return undefined;
      },
      async list() {
        return [];
      },
      async update() {
        return undefined;
      }
    });

    await expect(
      service.create({
        name: "name value",
        email: "person@example.com",
        isActive: true,
        status: "active",
        externalId: "00000000-0000-0000-0000-000000000001",
        lastContactedAt: "2026-06-29T00:00:00.000Z",
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).resolves.toMatchObject({
      name: "name value",
      email: "person@example.com",
      isActive: true,
      status: "active",
      externalId: "00000000-0000-0000-0000-000000000001",
      lastContactedAt: "2026-06-29T00:00:00.000Z",
    });
  });
});
