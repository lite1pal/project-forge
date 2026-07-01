import type { CreateTodoInput, TodoRecord, ListTodosInput, UpdateTodoInput } from "@auditrail/domain/generated/todo";

export interface TodoRepo {
  create(input: { organizationId: string; data: CreateTodoInput }): Promise<TodoRecord>;
  findById(input: { id: string; organizationId: string }): Promise<TodoRecord | undefined>;
  list(input: { organizationId: string; filters: ListTodosInput }): Promise<readonly TodoRecord[]>;
  update(input: { id: string; organizationId: string; data: UpdateTodoInput }): Promise<TodoRecord | undefined>;
}
