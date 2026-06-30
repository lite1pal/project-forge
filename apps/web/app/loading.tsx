import { EmptyState } from "@/src/components/ui/empty-state";
import { PageShell } from "@/src/components/ui/page-shell";

import { getProductLoadingLabel } from "@/app/product-module";

export default function Loading() {
  return (
    <PageShell>
      <EmptyState label={getProductLoadingLabel()} />
    </PageShell>
  );
}
