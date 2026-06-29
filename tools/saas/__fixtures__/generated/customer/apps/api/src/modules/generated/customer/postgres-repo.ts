import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { CustomerRepo } from "./repo.js";

export function createPostgresCustomerRepo(_db: NodePgDatabase): CustomerRepo {
  return {
    async create() {
      throw new Error("TODO: implement customer create persistence.");
    },
    async findById() {
      throw new Error("TODO: implement customer read persistence.");
    },
    async list() {
      throw new Error("TODO: implement customer list persistence.");
    },
    async update() {
      throw new Error("TODO: implement customer update persistence.");
    }
  };
}
