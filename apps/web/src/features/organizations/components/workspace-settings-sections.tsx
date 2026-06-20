import { ApiKeyList } from "@/src/features/api-keys/components/api-key-list";
import { CreateApiKeyForm } from "@/src/features/api-keys/components/create-api-key-form";
import { ProjectOnboardingPanel } from "@/src/features/api-keys/components/project-onboarding-panel";
import { AcceptInvitationForm } from "@/src/features/organizations/components/accept-invitation-form";
import { CreateOrganizationForm } from "@/src/features/organizations/components/create-organization-form";
import { CreateProjectForm } from "@/src/features/organizations/components/create-project-form";
import { InvitationLinkCard } from "@/src/features/organizations/components/invitation-link-card";
import { InviteMemberForm } from "@/src/features/organizations/components/invite-member-form";
import { ProjectList } from "@/src/features/organizations/components/project-list";
import { SettingsGroup } from "@/src/features/organizations/components/settings-group";
import type { Project } from "@/src/features/organizations/domain/schemas";
import type { WorkspaceSettingsScreenProps } from "@/src/features/organizations/components/workspace-settings-screen.types";

interface WorkspaceSettingsSectionsProps
  extends Pick<
    WorkspaceSettingsScreenProps,
    | "acceptInvitationAction"
    | "activeOrganizationId"
    | "activeProjectId"
    | "apiKeys"
    | "createApiKeyAction"
    | "createOrganizationAction"
    | "createProjectAction"
    | "ingestCommand"
    | "invitationUrl"
    | "inviteMemberAction"
    | "newApiKey"
    | "projects"
    | "revokeApiKeyAction"
  > {
  activeProject?: Project;
}

export function WorkspaceSettingsSections({
  acceptInvitationAction,
  activeOrganizationId,
  activeProject,
  activeProjectId,
  apiKeys,
  createApiKeyAction,
  createOrganizationAction,
  createProjectAction,
  ingestCommand,
  invitationUrl,
  inviteMemberAction,
  newApiKey,
  projects,
  revokeApiKeyAction
}: WorkspaceSettingsSectionsProps) {
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

      <SettingsGroup
        description="Invite teammates and share the current pending invitation without mixing it into project setup."
        id="access-settings"
        title="Access"
      >
        <section className="grid gap-4 lg:grid-cols-2">
          <InviteMemberForm action={inviteMemberAction} organizationId={activeOrganizationId} />
          <InvitationLinkCard invitationUrl={invitationUrl} />
        </section>
      </SettingsGroup>

      <SettingsGroup
        description="Create the project structure and pick the active project before generating ingest credentials."
        id="project-settings"
        title="Projects"
      >
        <section className="grid gap-4 lg:grid-cols-2">
          <CreateProjectForm action={createProjectAction} organizationId={activeOrganizationId} />
          <ProjectList
            activeProjectId={activeProjectId}
            organizationId={activeOrganizationId}
            projects={projects}
          />
        </section>
      </SettingsGroup>

      <SettingsGroup
        description="Generate project API keys, review existing keys, and copy the first ingest command."
        id="api-key-settings"
        title="API keys"
      >
        <section className="grid gap-4 lg:grid-cols-2">
          <CreateApiKeyForm
            action={createApiKeyAction}
            organizationId={activeOrganizationId}
            projectId={activeProjectId}
          />
          <ApiKeyList
            apiKeys={apiKeys}
            organizationId={activeOrganizationId}
            projectId={activeProjectId}
            revokeApiKeyAction={revokeApiKeyAction}
          />
        </section>
        <ProjectOnboardingPanel
          activeProjectName={activeProject?.name}
          createdApiKeyName={newApiKey?.name}
          createdRawKey={
            newApiKey && newApiKey.projectId === activeProjectId ? newApiKey.rawKey : undefined
          }
          ingestCommand={ingestCommand}
        />
      </SettingsGroup>
    </>
  );
}
