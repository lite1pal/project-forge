import { EmptyState } from "@/src/components/ui/empty-state";
import { PageShell } from "@/src/components/ui/page-shell";

import { getAuditTrailLoadingLabel } from "@/app/audit-product-chrome";

export default function Loading() {
  return (
    <PageShell>
      <EmptyState label={getAuditTrailLoadingLabel()} />
    </PageShell>
  );
}
