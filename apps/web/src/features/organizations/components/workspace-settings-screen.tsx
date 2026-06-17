import { AcceptInvitationForm } from "./accept-invitation-form";
import { CreateOrganizationForm } from "./create-organization-form";
import { CreateProjectForm } from "./create-project-form";
import { InviteMemberForm } from "./invite-member-form";
import { OrganizationSwitcher } from "./organization-switcher";
import { ProjectList } from "./project-list";
import type { Organization, Project } from "../domain/schemas";

interface WorkspaceSettingsScreenProps {
  acceptInvitationAction: (formData: FormData) => Promise<void>;
  activeOrganizationId?: string;
  createOrganizationAction: (formData: FormData) => Promise<void>;
  createProjectAction: (formData: FormData) => Promise<void>;
  invitationUrl?: string;
  inviteMemberAction: (formData: FormData) => Promise<void>;
  organizations: Organization[];
  projects: Project[];
}

export function WorkspaceSettingsScreen({
  acceptInvitationAction,
  activeOrganizationId,
  createOrganizationAction,
  createProjectAction,
  invitationUrl,
  inviteMemberAction,
  organizations,
  projects
}: WorkspaceSettingsScreenProps) {
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
      <ProjectList projects={projects} />
    </main>
  );
}
