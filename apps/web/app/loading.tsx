import { EmptyState } from "@/src/components/ui/empty-state";
import { PageShell } from "@/src/components/ui/page-shell";

export default function Loading() {
  return (
    <PageShell>
      <EmptyState label="Loading AuditTrail..." />
    </PageShell>
  );
}
