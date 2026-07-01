import { createTodoInputSchema, listTodosInputSchema, updateTodoInputSchema, type CreateTodoInput, type UpdateTodoInput } from "@auditrail/domain/generated/todo";

import type { TodoRepo } from "./repo.js";

export function createTodoService(repo: TodoRepo) {
  return {
    async create(input: { data: CreateTodoInput; organizationId: string }) {
      return repo.create({
        data: createTodoInputSchema.parse(input.data),
        organizationId: input.organizationId
      });
    },
    async get(input: { id: string; organizationId: string }) {
      return repo.findById(input);
    },
    async list(input: { organizationId: string; query?: string; limit?: number; cursor?: string }) {
      return repo.list({
        filters: listTodosInputSchema.parse({
          cursor: input.cursor,
          limit: input.limit,
          query: input.query
        }),
        organizationId: input.organizationId
      });
    },
    async update(input: { data: UpdateTodoInput; id: string; organizationId: string }) {
      return repo.update({
        data: updateTodoInputSchema.parse(input.data),
        id: input.id,
        organizationId: input.organizationId
      });
    }
  };
}
