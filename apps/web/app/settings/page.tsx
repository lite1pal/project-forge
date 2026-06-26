import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { WorkspaceSettingsScreen } from "@/src/features/organizations/components/workspace-settings-screen";
import {
  acceptInvitationAction,
  changeOrganizationPlanAction,
  createApiKeyAction,
  createOrganizationAction,
  createProjectAction,
  inviteMemberAction,
  loadWorkspacePage,
  requestBillingCheckoutAction,
  requestBillingPortalAction,
  revokeApiKeyAction
} from "@/src/features/organizations/server/organizations-server";

import { getAuditTrailShellProductConfig } from "@/app/audit-product-navigation";
import { getAuditTrailWorkspaceSettingsProductCopy } from "@/app/audit-product-settings";

interface SettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const currentUser = await requireCurrentUser();
  const workspace = await loadWorkspacePage(await searchParams, {
    currentUser
  });
  const shellProduct = getAuditTrailShellProductConfig({
    activeOrganizationId: workspace.activeOrganizationId,
    activeProjectId: workspace.activeProjectId
  });
  const settingsProductCopy = getAuditTrailWorkspaceSettingsProductCopy();

  return (
    <AppShell
      activeOrganizationId={workspace.activeOrganizationId}
      activeProjectId={workspace.activeProjectId}
      currentUser={currentUser}
      productName={shellProduct.productName}
      productNavItems={shellProduct.navItems}
    >
      <WorkspaceSettingsScreen
        acceptInvitationAction={acceptInvitationAction}
        activeOrganizationId={workspace.activeOrganizationId}
        billingStatus={workspace.billingStatus}
        activeOrganizationPlan={workspace.activeOrganizationPlan}
        activeOrganizationRole={workspace.activeOrganizationRole}
        activeProjectId={workspace.activeProjectId}
        changeOrganizationPlanAction={changeOrganizationPlanAction}
        apiKeys={workspace.apiKeys}
        createApiKeyAction={createApiKeyAction}
        requestBillingCheckoutAction={requestBillingCheckoutAction}
        requestBillingPortalAction={requestBillingPortalAction}
        createOrganizationAction={createOrganizationAction}
        createProjectAction={createProjectAction}
        ingestCommand={workspace.ingestCommand}
        invitationUrl={workspace.invitationUrl}
        inviteMemberAction={inviteMemberAction}
        newApiKey={workspace.newApiKey}
        organizations={workspace.organizations}
        productCopy={settingsProductCopy}
        projects={workspace.projects}
        revokeApiKeyAction={revokeApiKeyAction}
      />
    </AppShell>
  );
}
