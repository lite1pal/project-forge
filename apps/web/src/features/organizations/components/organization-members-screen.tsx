import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageShell } from "@/src/components/ui/page-shell";
import { SectionHeader } from "@/src/components/ui/section-header";
import type { OrganizationMember } from "@/src/features/organizations/domain/schemas";

interface OrganizationMembersScreenProps {
  members: OrganizationMember[];
  organizationName?: string;
}

export function OrganizationMembersScreen({
  members,
  organizationName
}: OrganizationMembersScreenProps) {
  return (
    <PageShell>
      <SectionHeader
        eyebrow="Members"
        title={organizationName ? `${organizationName} members` : "Organization members"}
      />
      {members.length === 0 ? (
        <EmptyState label="No organization members are visible for this workspace yet." />
      ) : (
        <Card className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-lg font-bold">Member roster</h2>
            <p className="text-sm text-[var(--muted)]">
              Everyone who currently belongs to the selected organization.
            </p>
          </div>
          <ul className="grid gap-3">
            {members.map((member) => (
              <li
                className="grid gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-3"
                key={member.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{member.name ?? member.email}</strong>
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em]">
                    {member.role}
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)]">{member.email}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}
