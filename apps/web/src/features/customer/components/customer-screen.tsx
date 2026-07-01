import type { CustomerRecord } from "../domain/schemas.js";

import { CustomerEmptyState } from "./customer-empty-state.js";
import { CustomerTable } from "./customer-table.js";

export function CustomerScreen(input: {
  items: readonly CustomerRecord[];
}) {
  if (input.items.length === 0) {
    return <CustomerEmptyState />;
  }

  return <CustomerTable items={input.items} />;
}
