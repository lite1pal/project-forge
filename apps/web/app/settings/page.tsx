import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { WorkspaceSettingsScreen } from "@/src/features/organizations/components/workspace-settings-screen";
import {
  acceptInvitationAction,
  createApiKeyAction,
  createOrganizationAction,
  createProjectAction,
  inviteMemberAction,
  loadWorkspacePage,
  revokeApiKeyAction
} from "@/src/features/organizations/server/organizations-server";

interface SettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const currentUser = await requireCurrentUser();
  const workspace = await loadWorkspacePage(await searchParams, {
    currentUser
  });

  return (
    <AppShell
      activeOrganizationId={workspace.activeOrganizationId}
      activeProjectId={workspace.activeProjectId}
      currentUser={currentUser}
    >
      <WorkspaceSettingsScreen
        acceptInvitationAction={acceptInvitationAction}
        activeOrganizationId={workspace.activeOrganizationId}
        activeOrganizationRole={workspace.activeOrganizationRole}
        activeProjectId={workspace.activeProjectId}
        apiKeys={workspace.apiKeys}
        createApiKeyAction={createApiKeyAction}
        createOrganizationAction={createOrganizationAction}
        createProjectAction={createProjectAction}
        ingestCommand={workspace.ingestCommand}
        invitationUrl={workspace.invitationUrl}
        inviteMemberAction={inviteMemberAction}
        newApiKey={workspace.newApiKey}
        organizations={workspace.organizations}
        projects={workspace.projects}
        revokeApiKeyAction={revokeApiKeyAction}
      />
    </AppShell>
  );
}
