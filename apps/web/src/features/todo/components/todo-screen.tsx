import type { TodoRecord } from "../domain/schemas.js";

import { TodoEmptyState } from "./todo-empty-state.js";
import { TodoTable } from "./todo-table.js";

export function TodoScreen(input: {
  items: readonly TodoRecord[];
  organizationId?: string;
  projectId?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <TodoEmptyState />;
  }

  return (
    <TodoTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
