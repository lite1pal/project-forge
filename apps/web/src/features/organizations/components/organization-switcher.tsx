import Link from "next/link";

import type { Organization } from "@/src/features/organizations/domain/schemas";

interface OrganizationSwitcherProps {
  activeOrganizationId?: string;
  organizations: Organization[];
}

export function OrganizationSwitcher({
  activeOrganizationId,
  organizations
}: OrganizationSwitcherProps) {
  if (organizations.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No organizations yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {organizations.map((organization) => (
        <Link
          className={
            organization.id === activeOrganizationId
              ? "rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-bold text-[var(--panel)]"
              : "rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold"
          }
          href={`/settings?organizationId=${organization.id}`}
          key={organization.id}
        >
          {organization.name}
        </Link>
      ))}
    </div>
  );
}
