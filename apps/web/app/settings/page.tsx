import { AppShell } from "../../src/components/layout/app-shell";
import { requireCurrentUser } from "../../src/features/auth/server/auth-server";
import { WorkspaceSettingsScreen } from "../../src/features/organizations/components/workspace-settings-screen";
import {
  acceptInvitationAction,
  createOrganizationAction,
  createProjectAction,
  inviteMemberAction,
  loadWorkspacePage
} from "../../src/features/organizations/server/organizations-server";

interface SettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const currentUser = await requireCurrentUser();
  const workspace = await loadWorkspacePage(await searchParams);

  return (
    <AppShell currentUser={currentUser}>
      <WorkspaceSettingsScreen
        acceptInvitationAction={acceptInvitationAction}
        activeOrganizationId={workspace.activeOrganizationId}
        createOrganizationAction={createOrganizationAction}
        createProjectAction={createProjectAction}
        invitationUrl={workspace.invitationUrl}
        inviteMemberAction={inviteMemberAction}
        organizations={workspace.organizations}
        projects={workspace.projects}
      />
    </AppShell>
  );
}
