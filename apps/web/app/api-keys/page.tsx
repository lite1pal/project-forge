import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { ApiKeysScreen } from "@/src/features/api-keys/components/api-keys-screen";
import {
  createApiKeyAction,
  loadWorkspacePage,
  revokeApiKeyAction
} from "@/src/features/organizations/server/organizations-server";

interface ApiKeysPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ApiKeysPage({ searchParams }: ApiKeysPageProps) {
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
      <ApiKeysScreen
        activeOrganizationId={workspace.activeOrganizationId}
        activeProjectId={workspace.activeProjectId}
        apiKeys={workspace.apiKeys}
        createApiKeyAction={createApiKeyAction}
        currentUserEmail={currentUser.user.email}
        newApiKey={workspace.newApiKey}
        organizationName={
          workspace.organizations.find(
            (organization) => organization.id === workspace.activeOrganizationId
          )?.name
        }
        projectName={
          workspace.projects.find((project) => project.id === workspace.activeProjectId)?.name
        }
        revokeApiKeyAction={revokeApiKeyAction}
      />
    </AppShell>
  );
}
