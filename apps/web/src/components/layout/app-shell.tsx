import type { ReactNode } from "react";

import { Button } from "../ui/button";
import { logoutAction } from "../../features/auth/server/auth-server";
import type { CurrentUserResponse } from "../../features/auth/domain/schemas";

interface AppShellProps {
  children: ReactNode;
  currentUser: CurrentUserResponse;
}

export function AppShell({ children, currentUser }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div>
            <strong>AuditTrail</strong>
            <p className="text-sm text-[var(--muted)]">{currentUser.user.email}</p>
          </div>
          <form action={logoutAction}>
            <Button size="sm" type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
