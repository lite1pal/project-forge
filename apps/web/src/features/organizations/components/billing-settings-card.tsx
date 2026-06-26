import { BillingSettingsActions } from "@/src/features/organizations/components/billing-settings-actions";
import type {
  WorkspaceBillingActionState,
  WorkspaceSettingsScreenProps
} from "@/src/features/organizations/components/workspace-settings-screen.types";
import type { OrganizationBillingStatus } from "@/src/features/organizations/domain/schemas";

interface BillingSettingsCardProps {
  billingStatus?: OrganizationBillingStatus;
  checkoutAction: (
    state: WorkspaceBillingActionState,
    formData: FormData
  ) => Promise<WorkspaceBillingActionState>;
  organizationId?: string;
  portalAction: (
    state: WorkspaceBillingActionState,
    formData: FormData
  ) => Promise<WorkspaceBillingActionState>;
  role?: WorkspaceSettingsScreenProps["activeOrganizationRole"];
}

export function BillingSettingsCard({
  billingStatus,
  checkoutAction,
  organizationId,
  portalAction,
  role
}: BillingSettingsCardProps) {
  if (!organizationId) {
    return <EmptyBillingState message="Select an organization to review its billing status." />;
  }

  const subscription = billingStatus?.subscription;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BillingMetric label="Current plan" value={subscription?.billingPlanId ?? "Not connected"} />
        <BillingMetric
          label="Subscription status"
          value={subscription ? formatStatus(subscription.status) : "No active subscription"}
        />
        <BillingMetric
          label="Current period"
          value={formatBillingPeriod(subscription?.currentPeriodStart, subscription?.currentPeriodEnd)}
        />
        <BillingMetric
          label="Provider"
          value={billingStatus?.customer?.provider ?? subscription?.provider ?? "Not configured"}
        />
      </div>
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] p-4 text-sm text-[var(--muted)]">
        Billing is not connected for this organization yet. Checkout and customer portal
        actions will return a not-configured response until a provider is added.
      </div>
      <BillingSettingsActions
        canManage={role === "owner" || role === "admin"}
        checkoutAction={checkoutAction}
        defaultPlanId={subscription?.billingPlanId ?? "billing-self-serve"}
        defaultPriceId={subscription?.providerPriceId ?? "billing-self-serve"}
        organizationId={organizationId}
        portalAction={portalAction}
      />
    </div>
  );
}

function BillingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-subtle)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function EmptyBillingState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] p-5 text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}

function formatBillingPeriod(start?: string, end?: string) {
  if (!start || !end) {
    return "Not available";
  }

  return `${formatDate(start)} to ${formatDate(end)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}
