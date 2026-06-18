import { AuditEventsScreen } from "@/src/features/audit-events/components/audit-events-screen";
import {
  parseEventSearchParams,
} from "@/src/features/audit-events/domain/query";
import { loadAuditEventsPage } from "@/src/features/audit-events/server/load-audit-events-page";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { AppShell } from "@/src/components/layout/app-shell";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomeProps) {
  const currentUser = await requireCurrentUser();
  const resolvedSearchParams = await searchParams;
  const query = parseEventSearchParams(resolvedSearchParams);
  const workspace = resolveWorkspaceContext(currentUser, {
    organizationId: getSearchValue(resolvedSearchParams.organizationId),
    projectId: getSearchValue(resolvedSearchParams.projectId)
  });
  const data =
    workspace.activeOrganizationId && workspace.activeProjectId
      ? await loadAuditEventsPage(query, {
          organizationId: workspace.activeOrganizationId,
          projectId: workspace.activeProjectId
        })
      : {
          events: {
            events: [],
            pageInfo: {
              hasMore: false,
              nextCursor: null
            }
          },
          stats: {
            topEventTypes: [],
            totalEvents: 0
          },
          timeseries: {
            points: []
          }
        };

  return (
    <AppShell
      activeOrganizationId={workspace.activeOrganizationId}
      activeProjectId={workspace.activeProjectId}
      currentUser={currentUser}
    >
      <AuditEventsScreen
        initialEvents={data.events}
        query={query}
        stats={data.stats}
        timeseries={data.timeseries}
        workspace={{
          organizationId: workspace.activeOrganizationId,
          projectId: workspace.activeProjectId
        }}
      />
    </AppShell>
  );
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
