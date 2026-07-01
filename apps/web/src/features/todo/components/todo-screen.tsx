import type { TodoRecord } from "../domain/schemas.js";

import { TodoEmptyState } from "./todo-empty-state.js";
import { TodoTable } from "./todo-table.js";

export function TodoScreen(input: {
  items: readonly TodoRecord[];
}) {
  if (input.items.length === 0) {
    return <TodoEmptyState />;
  }

  return <TodoTable items={input.items} />;
}
