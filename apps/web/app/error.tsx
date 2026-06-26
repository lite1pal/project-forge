"use client";

import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageShell } from "@/src/components/ui/page-shell";

import { getAuditTrailErrorHeading } from "@/app/audit-product-chrome";

interface ErrorPageProps {
  error: Error;
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <PageShell>
      <EmptyState label="" role="alert">
        <h1 className="mb-2 text-xl font-bold text-[var(--foreground)]">
          {getAuditTrailErrorHeading()}
        </h1>
        <p>{error.message}</p>
        <Button className="mt-4" onClick={reset}>
          Retry
        </Button>
      </EmptyState>
    </PageShell>
  );
}
