import { describe, expect, it } from "vitest";

import { createTodoService } from "../service.js";

describe("createTodoService", () => {
  it("validates create input before writing todo records", async () => {
    const service = createTodoService({
      async create(input) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: input.organizationId,
          title: "title value",
          details: "details value",
          status: "todo",
          dueAt: "2026-06-29T00:00:00.000Z",
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
        data: {
          title: "title value",
          details: "details value",
          status: "todo",
          dueAt: "2026-06-29T00:00:00.000Z",
        },
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).resolves.toMatchObject({
      title: "title value",
      details: "details value",
      status: "todo",
      dueAt: "2026-06-29T00:00:00.000Z",
    });
  });
});
