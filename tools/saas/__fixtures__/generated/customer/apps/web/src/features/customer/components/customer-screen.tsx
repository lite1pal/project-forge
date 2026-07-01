import type { CustomerRecord } from "../domain/schemas.js";

import { CustomerEmptyState } from "./customer-empty-state.js";
import { CustomerTable } from "./customer-table.js";

export function CustomerScreen(input: {
  items: readonly CustomerRecord[];
  organizationId?: string;
  projectId?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <CustomerEmptyState />;
  }

  return (
    <CustomerTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
