import { AcceptInvitationForm } from "@/src/features/organizations/components/accept-invitation-form";
import { CreateOrganizationForm } from "@/src/features/organizations/components/create-organization-form";
import { CreateProjectForm } from "@/src/features/organizations/components/create-project-form";
import { InvitationLinkCard } from "@/src/features/organizations/components/invitation-link-card";
import { InviteMemberForm } from "@/src/features/organizations/components/invite-member-form";
import { ProjectList } from "@/src/features/organizations/components/project-list";
import { SettingsGroup } from "@/src/features/organizations/components/settings-group";
import { WorkspaceSettingsBillingSections } from "@/src/features/organizations/components/workspace-settings-billing-sections";
import type { WorkspaceSettingsScreenProps } from "@/src/features/organizations/components/workspace-settings-screen.types";

interface WorkspaceSettingsSectionsProps
  extends Pick<
    WorkspaceSettingsScreenProps,
    | "acceptInvitationAction"
    | "activeOrganizationId"
    | "billingStatus"
    | "activeOrganizationPlan"
    | "activeOrganizationRole"
    | "activeProjectId"
    | "changeOrganizationPlanAction"
    | "requestBillingCheckoutAction"
    | "requestBillingPortalAction"
    | "createOrganizationAction"
    | "createProjectAction"
    | "invitationUrl"
    | "inviteMemberAction"
    | "productCopy"
    | "projects"
  > {}

export function WorkspaceSettingsSections({
  acceptInvitationAction,
  activeOrganizationId,
  billingStatus,
  activeOrganizationPlan,
  activeOrganizationRole,
  activeProjectId,
  changeOrganizationPlanAction,
  requestBillingCheckoutAction,
  requestBillingPortalAction,
  createOrganizationAction,
  createProjectAction,
  invitationUrl,
  inviteMemberAction,
  productCopy,
  projects
}: WorkspaceSettingsSectionsProps) {
  const canManageWorkspace =
    activeOrganizationRole === "owner" || activeOrganizationRole === "admin";

  return (
    <>
      <SettingsGroup
        description="Choose the organization context and create the base workspace before adding projects or keys."
        id="workspace-settings"
        title="Workspace"
      >
        <section className="grid gap-4 lg:grid-cols-2">
          <CreateOrganizationForm action={createOrganizationAction} />
          <AcceptInvitationForm action={acceptInvitationAction} />
        </section>
      </SettingsGroup>

      <WorkspaceSettingsBillingSections
        activeOrganizationId={activeOrganizationId}
        billingStatus={billingStatus}
        activeOrganizationPlan={activeOrganizationPlan}
        activeOrganizationRole={activeOrganizationRole}
        changeOrganizationPlanAction={changeOrganizationPlanAction}
        productCopy={productCopy}
        requestBillingCheckoutAction={requestBillingCheckoutAction}
        requestBillingPortalAction={requestBillingPortalAction}
      />

      <SettingsGroup
        description="Invite teammates and share the current pending invitation without mixing it into project setup."
        id="access-settings"
        title="Access"
      >
        <section className="grid gap-4 lg:grid-cols-2">
          <InviteMemberForm
            action={inviteMemberAction}
            canManage={canManageWorkspace}
            organizationId={activeOrganizationId}
          />
          <InvitationLinkCard invitationUrl={invitationUrl} />
        </section>
      </SettingsGroup>

      <SettingsGroup
        description="Create the project structure and pick the active project before generating ingest credentials."
        id="project-settings"
        title="Projects"
      >
        <section className="grid gap-4 lg:grid-cols-2">
          <CreateProjectForm
            action={createProjectAction}
            canManage={canManageWorkspace}
            organizationId={activeOrganizationId}
          />
          <ProjectList
            activeProjectId={activeProjectId}
            organizationId={activeOrganizationId}
            projects={projects}
          />
        </section>
      </SettingsGroup>
    </>
  );
}
