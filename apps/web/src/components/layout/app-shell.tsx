import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "../ui/button";
import { logoutAction } from "../../features/auth/server/auth-server";
import type { CurrentUserResponse } from "../../features/auth/domain/schemas";
import { toWorkspaceViewModel } from "../../features/organizations/domain/presenters";

interface AppShellProps {
  children: ReactNode;
  currentUser: CurrentUserResponse;
}

export function AppShell({ children, currentUser }: AppShellProps) {
  const workspace = toWorkspaceViewModel(currentUser);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div>
            <strong>AuditTrail</strong>
            <p className="text-sm text-[var(--muted)]">
              {workspace.activeOrganization?.name ?? "No organization"} ·{" "}
              {workspace.activeProject?.name ?? "No project"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link className="text-sm font-bold" href="/">
              Dashboard
            </Link>
            <Link className="text-sm font-bold" href="/settings">
              Settings
            </Link>
            <form action={logoutAction}>
              <Button size="sm" type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
