"use client";

import { useActionState } from "react";

import { Button } from "@/src/components/ui/button";
import type { WorkspaceBillingActionState } from "@/src/features/organizations/components/workspace-settings-screen.types";

const idleActionState: WorkspaceBillingActionState = {
  status: "idle"
};

interface BillingSettingsActionsProps {
  canManage: boolean;
  checkoutAction: (
    state: WorkspaceBillingActionState,
    formData: FormData
  ) => Promise<WorkspaceBillingActionState>;
  defaultPlanId: string;
  defaultPriceId: string;
  organizationId?: string;
  portalAction: (
    state: WorkspaceBillingActionState,
    formData: FormData
  ) => Promise<WorkspaceBillingActionState>;
}

export function BillingSettingsActions({
  canManage,
  checkoutAction,
  defaultPlanId,
  defaultPriceId,
  organizationId,
  portalAction
}: BillingSettingsActionsProps) {
  const [checkoutState, checkoutFormAction, checkoutPending] = useActionState(
    checkoutAction,
    idleActionState
  );
  const [portalState, portalFormAction, portalPending] = useActionState(
    portalAction,
    idleActionState
  );

  if (!organizationId) {
    return null;
  }

  if (!canManage) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Only organization owners and admins can start billing actions.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={checkoutFormAction}>
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="planId" type="hidden" value={defaultPlanId} />
          <input name="priceId" type="hidden" value={defaultPriceId} />
          <Button disabled={checkoutPending} size="sm" type="submit" variant="secondary">
            {checkoutPending ? "Starting checkout..." : "Start checkout"}
          </Button>
        </form>
        <form action={portalFormAction}>
          <input name="organizationId" type="hidden" value={organizationId} />
          <Button disabled={portalPending} size="sm" type="submit" variant="secondary">
            {portalPending ? "Opening portal..." : "Open customer portal"}
          </Button>
        </form>
      </div>
      {checkoutState.message ? (
        <p className="text-sm text-[var(--muted)]">{checkoutState.message}</p>
      ) : null}
      {!checkoutState.message && portalState.message ? (
        <p className="text-sm text-[var(--muted)]">{portalState.message}</p>
      ) : null}
    </div>
  );
}
