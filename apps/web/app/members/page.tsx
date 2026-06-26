import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { OrganizationMembersScreen } from "@/src/features/organizations/components/organization-members-screen";
import { loadOrganizationMembersPage } from "@/src/features/organizations/server/organizations-server";

import { getAuditTrailShellProductConfig } from "@/app/audit-product-navigation";

interface MembersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const currentUser = await requireCurrentUser();
  const membersPage = await loadOrganizationMembersPage(await searchParams, {
    currentUser
  });
  const organizationName = currentUser.memberships.find(
    (membership) => membership.organization.id === membersPage.activeOrganizationId
  )?.organization.name;
  const shellProduct = getAuditTrailShellProductConfig({
    activeOrganizationId: membersPage.activeOrganizationId,
    activeProjectId: membersPage.activeProjectId
  });

  return (
    <AppShell
      activeOrganizationId={membersPage.activeOrganizationId}
      activeProjectId={membersPage.activeProjectId}
      currentUser={currentUser}
      productName={shellProduct.productName}
      productNavItems={shellProduct.navItems}
    >
      <OrganizationMembersScreen
        members={membersPage.members}
        organizationName={organizationName}
      />
    </AppShell>
  );
}
