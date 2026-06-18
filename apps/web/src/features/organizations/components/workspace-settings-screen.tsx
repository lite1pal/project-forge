import { ApiKeyList } from "../../api-keys/components/api-key-list";
import { CreateApiKeyForm } from "../../api-keys/components/create-api-key-form";
import { ProjectOnboardingPanel } from "../../api-keys/components/project-onboarding-panel";
import { AcceptInvitationForm } from "./accept-invitation-form";
import { CreateOrganizationForm } from "./create-organization-form";
import { CreateProjectForm } from "./create-project-form";
import { InviteMemberForm } from "./invite-member-form";
import { OrganizationSwitcher } from "./organization-switcher";
import { ProjectList } from "./project-list";
import type { Organization, Project } from "../domain/schemas";
import type { ManagedApiKey } from "../../api-keys/domain/schemas";

interface WorkspaceSettingsScreenProps {
  acceptInvitationAction: (formData: FormData) => Promise<void>;
  activeOrganizationId?: string;
  activeProjectId?: string;
  apiKeys: ManagedApiKey[];
  createApiKeyAction: (formData: FormData) => Promise<void>;
  createOrganizationAction: (formData: FormData) => Promise<void>;
  createProjectAction: (formData: FormData) => Promise<void>;
  ingestCommand?: string;
  invitationUrl?: string;
  inviteMemberAction: (formData: FormData) => Promise<void>;
  newApiKey?: {
    name: string;
    projectId: string;
    rawKey: string;
  };
  organizations: Organization[];
  projects: Project[];
  revokeApiKeyAction: (formData: FormData) => Promise<void>;
}

export function WorkspaceSettingsScreen({
  acceptInvitationAction,
  activeOrganizationId,
  activeProjectId,
  apiKeys,
  createApiKeyAction,
  createOrganizationAction,
  createProjectAction,
  ingestCommand,
  invitationUrl,
  inviteMemberAction,
  newApiKey,
  organizations,
  projects,
  revokeApiKeyAction
}: WorkspaceSettingsScreenProps) {
  const activeProject = projects.find((project) => project.id === activeProjectId);

  return (
    <main className="mx-auto grid max-w-[1180px] gap-6 px-4 py-6 md:px-6">
      <section className="grid gap-2">
        <h1 className="text-2xl font-bold">Workspace settings</h1>
        <OrganizationSwitcher
          activeOrganizationId={activeOrganizationId}
          organizations={organizations}
        />
      </section>
      {invitationUrl ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] p-4">
          <p className="text-sm font-bold">Invitation URL</p>
          <code className="mt-2 block break-all text-sm">{invitationUrl}</code>
        </section>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-2">
        <CreateOrganizationForm action={createOrganizationAction} />
        <AcceptInvitationForm action={acceptInvitationAction} />
        <CreateProjectForm
          action={createProjectAction}
          organizationId={activeOrganizationId}
        />
        <InviteMemberForm
          action={inviteMemberAction}
          organizationId={activeOrganizationId}
        />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <ProjectList
          activeProjectId={activeProjectId}
          organizationId={activeOrganizationId}
          projects={projects}
        />
        <ProjectOnboardingPanel
          activeProjectName={activeProject?.name}
          createdApiKeyName={newApiKey?.name}
          createdRawKey={
            newApiKey && newApiKey.projectId === activeProjectId
              ? newApiKey.rawKey
              : undefined
          }
          ingestCommand={ingestCommand}
        />
      </section>
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
    </main>
  );
}
