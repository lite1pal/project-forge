import { BillingSettingsCard } from "@/src/features/organizations/components/billing-settings-card";
import { OrganizationPlanUsageCard } from "@/src/features/organizations/components/organization-plan-usage-card";
import { SettingsGroup } from "@/src/features/organizations/components/settings-group";
import type { WorkspaceSettingsScreenProps } from "@/src/features/organizations/components/workspace-settings-screen.types";

type WorkspaceSettingsBillingSectionsProps = Pick<
  WorkspaceSettingsScreenProps,
  | "activeOrganizationId"
  | "billingStatus"
  | "activeOrganizationPlan"
  | "activeOrganizationRole"
  | "changeOrganizationPlanAction"
  | "productCopy"
  | "requestBillingCheckoutAction"
  | "requestBillingPortalAction"
>;

export function WorkspaceSettingsBillingSections({
  activeOrganizationId,
  billingStatus,
  activeOrganizationPlan,
  activeOrganizationRole,
  changeOrganizationPlanAction,
  productCopy,
  requestBillingCheckoutAction,
  requestBillingPortalAction
}: WorkspaceSettingsBillingSectionsProps) {
  return (
    <>
      <SettingsGroup
        description={productCopy.planUsage.sectionDescription}
        id="plan-settings"
        title={productCopy.planUsage.sectionTitle}
      >
        <OrganizationPlanUsageCard
          action={changeOrganizationPlanAction}
          organizationId={activeOrganizationId}
          plan={activeOrganizationPlan}
          productCopy={productCopy.planUsage}
          role={activeOrganizationRole}
        />
      </SettingsGroup>

      <SettingsGroup
        description="Review the persisted billing state for this organization and retry the generic checkout or customer portal actions."
        id="billing-settings"
        title="Billing"
      >
        <BillingSettingsCard
          billingStatus={billingStatus}
          checkoutAction={requestBillingCheckoutAction}
          organizationId={activeOrganizationId}
          portalAction={requestBillingPortalAction}
          role={activeOrganizationRole}
        />
      </SettingsGroup>
    </>
  );
}
