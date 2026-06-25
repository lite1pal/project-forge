import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";

import { loadPublicConfig } from "@/src/config/env";
import { Button } from "@/src/components/ui/button";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import { buildAuthActionUrl } from "@/src/features/auth/domain/action-urls";
import { toWorkspaceViewModel } from "@/src/features/organizations/domain/presenters";
import { WorkspaceSidebarSwitcher } from "@/src/features/organizations/components/workspace-sidebar-switcher";

interface AppShellProps {
  activeOrganizationId?: string;
  activeProjectId?: string;
  children: ReactNode;
  currentUser: CurrentUserResponse;
}

export function AppShell({
  activeOrganizationId,
  activeProjectId,
  children,
  currentUser,
}: AppShellProps) {
  const workspace = toWorkspaceViewModel(currentUser, {
    organizationId: activeOrganizationId,
    projectId: activeProjectId,
  });
  const workspaceSuffix = workspace.activeOrganization
    ? `?organizationId=${workspace.activeOrganization.id}${workspace.activeProject ? `&projectId=${workspace.activeProject.id}` : ""}`
    : "";
  const dashboardHref = workspaceSuffix
    ? {
        pathname: "/",
        query: Object.fromEntries(new URLSearchParams(workspaceSuffix)),
      }
    : "/";
  const settingsHref = workspaceSuffix
    ? {
        pathname: "/settings",
        query: Object.fromEntries(new URLSearchParams(workspaceSuffix)),
      }
    : "/settings";
  const apiKeysHref = workspaceSuffix
    ? (`/api-keys${workspaceSuffix}` as Route)
    : ("/api-keys" as Route);
  const membersHref = workspaceSuffix
    ? (`/members${workspaceSuffix}` as Route)
    : ("/members" as Route);
  const logoutAction = buildAuthActionUrl(
    loadPublicConfig().NEXT_PUBLIC_API_BASE_URL,
    "/api/v1/auth/sessions/current/logout",
    {
      redirectTo: "/auth/sign-in"
    }
  );

  return (
    <div className="min-h-screen xl:grid xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 md:px-6 xl:min-h-screen xl:border-r xl:border-b-0 xl:px-5 xl:py-6">
        <div className="mx-auto grid max-w-[1240px] gap-6 xl:max-w-none xl:grid-rows-[auto_auto_1fr_auto]">
          <div className="grid gap-1 px-1">
            <strong className="text-base font-semibold">AuditTrail</strong>
            <p className="text-xs text-[var(--muted)]">
              {workspace.activeOrganization?.name ?? "No organization"} ·{" "}
              {workspace.activeProject?.name ?? "No project"}
            </p>
          </div>
          <nav aria-label="Primary">
            <ul className="grid gap-1">
              <li>
                <Link
                  className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-subtle)]"
                  href={dashboardHref}
                >
                  Events
                </Link>
              </li>
              <li>
                <Link
                  className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-subtle)]"
                  href={apiKeysHref}
                >
                  API Keys
                </Link>
              </li>
              <li>
                <Link
                  className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-subtle)]"
                  href={membersHref}
                >
                  Members
                </Link>
              </li>
              <li>
                <Link
                  className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-subtle)]"
                  href={settingsHref}
                >
                  Settings
                </Link>
              </li>
            </ul>
          </nav>
          <div />
          <div className="grid gap-4 border-t border-[var(--border)] pt-4">
            <WorkspaceSidebarSwitcher
              activeOrganizationId={workspace.activeOrganization?.id}
              activeProjectId={workspace.activeProject?.id}
              memberships={currentUser.memberships}
            />
            <form action={logoutAction} method="post">
              <Button
                className="w-full justify-start px-3"
                size="sm"
                type="submit"
                variant="ghost"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
