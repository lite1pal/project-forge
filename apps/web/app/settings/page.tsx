import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { WorkspaceSettingsScreen } from "@/src/features/organizations/components/workspace-settings-screen";
import {
  acceptInvitationAction,
  changeOrganizationPlanAction,
  createApiKeyAction,
  createOrganizationAction,
  createProjectAction,
  createProjectWebhookAction,
  deleteProjectWebhookAction,
  inviteMemberAction,
  loadWorkspacePage,
  requestBillingCheckoutAction,
  requestBillingPortalAction,
  rotateProjectWebhookSecretAction,
  revokeApiKeyAction,
  updateProjectWebhookAction
} from "@/src/features/organizations/server/organizations-server";

import {
  currentProductId,
  getShellProductConfig,
  getWorkspaceSettingsProductCopy
} from "@/app/product-module";

interface SettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const currentUser = await requireCurrentUser();
  const workspace = await loadWorkspacePage(await searchParams, {
    currentUser,
    productId: currentProductId
  });
  const shellProduct = getShellProductConfig({
    activeOrganizationId: workspace.activeOrganizationId,
    activeProjectId: workspace.activeProjectId
  });
  const settingsProductCopy = getWorkspaceSettingsProductCopy();

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
        activeProjectWebhookSecret={workspace.activeProjectWebhookSecret}
        changeOrganizationPlanAction={changeOrganizationPlanAction}
        apiKeys={workspace.apiKeys}
        createApiKeyAction={createApiKeyAction}
        requestBillingCheckoutAction={requestBillingCheckoutAction}
        requestBillingPortalAction={requestBillingPortalAction}
        createOrganizationAction={createOrganizationAction}
        createProjectAction={createProjectAction}
        createProjectWebhookAction={createProjectWebhookAction}
        deleteProjectWebhookAction={deleteProjectWebhookAction}
        ingestCommand={workspace.ingestCommand}
        invitationUrl={workspace.invitationUrl}
        inviteMemberAction={inviteMemberAction}
        newApiKey={workspace.newApiKey}
        organizations={workspace.organizations}
        projectWebhooks={workspace.projectWebhooks}
        productCopy={settingsProductCopy}
        projects={workspace.projects}
        rotateProjectWebhookSecretAction={rotateProjectWebhookSecretAction}
        revokeApiKeyAction={revokeApiKeyAction}
        updateProjectWebhookAction={updateProjectWebhookAction}
      />
    </AppShell>
  );
}
