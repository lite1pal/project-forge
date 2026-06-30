import Link from "next/link";
import type { UrlObject } from "url";

import { Button } from "@/src/components/ui/button";
import { SettingsSectionsNav } from "@/src/features/organizations/components/settings-sections-nav";
import { WorkspaceSettingsHero } from "@/src/features/organizations/components/workspace-settings-hero";
import { WorkspaceSettingsSections } from "@/src/features/organizations/components/workspace-settings-sections";
import type { WorkspaceSettingsScreenProps } from "@/src/features/organizations/components/workspace-settings-screen.types";

export function WorkspaceSettingsScreen({
  acceptInvitationAction,
  activeOrganizationId,
  billingStatus,
  activeOrganizationPlan,
  activeOrganizationRole,
  activeProjectId,
  activeProjectWebhookSecret,
  changeOrganizationPlanAction,
  apiKeys,
  requestBillingCheckoutAction,
  requestBillingPortalAction,
  createOrganizationAction,
  createProjectWebhookAction,
  createProjectAction,
  deleteProjectWebhookAction,
  invitationUrl,
  inviteMemberAction,
  organizations,
  projectWebhooks = [],
  productCopy,
  projects,
  rotateProjectWebhookSecretAction,
  updateProjectWebhookAction
}: WorkspaceSettingsScreenProps) {
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const dashboardHref = toDashboardHref(activeOrganizationId, activeProjectId);

  return (
    <main className="mx-auto grid max-w-[1240px] gap-8 px-4 py-6 md:px-6 md:py-10 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="self-start xl:sticky xl:top-6">
        <SettingsSectionsNav planUsage={productCopy.planUsage} />
      </aside>
      <div className="grid gap-8">
        <WorkspaceSettingsHero
          activeOrganizationId={activeOrganizationId}
          activeProject={activeProject}
          apiKeyCount={apiKeys.length}
          dashboardHref={dashboardHref}
          organizations={organizations}
          projects={projects}
        />
        <WorkspaceSettingsSections
          acceptInvitationAction={acceptInvitationAction}
          activeOrganizationId={activeOrganizationId}
          billingStatus={billingStatus}
          activeOrganizationPlan={activeOrganizationPlan}
          activeOrganizationRole={activeOrganizationRole}
          activeProjectId={activeProjectId}
          activeProjectWebhookSecret={activeProjectWebhookSecret}
          changeOrganizationPlanAction={changeOrganizationPlanAction}
          requestBillingCheckoutAction={requestBillingCheckoutAction}
          requestBillingPortalAction={requestBillingPortalAction}
          createOrganizationAction={createOrganizationAction}
          createProjectWebhookAction={createProjectWebhookAction}
          createProjectAction={createProjectAction}
          deleteProjectWebhookAction={deleteProjectWebhookAction}
          invitationUrl={invitationUrl}
          inviteMemberAction={inviteMemberAction}
          projectWebhooks={projectWebhooks}
          productCopy={productCopy}
          projects={projects}
          rotateProjectWebhookSecretAction={rotateProjectWebhookSecretAction}
          updateProjectWebhookAction={updateProjectWebhookAction}
        />
      </div>
    </main>
  );
}

function toDashboardHref(
  organizationId?: string,
  projectId?: string
): UrlObject {
  if (!organizationId) {
    return {
      pathname: "/"
    };
  }

  return projectId
    ? {
        pathname: "/",
        query: {
          organizationId,
          projectId
        }
      }
    : {
        pathname: "/",
        query: {
          organizationId
        }
      };
}
