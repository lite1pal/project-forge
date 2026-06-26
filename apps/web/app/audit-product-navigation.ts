import { auditTrailProduct } from "@auditrail/domain/audit-events";

export interface AppShellProductNavItem {
  href: string;
  id: string;
  label: string;
}

export interface AppShellProductConfig {
  navItems: AppShellProductNavItem[];
  productName: string;
}

export function getAuditTrailShellProductConfig(input: {
  activeOrganizationId?: string;
  activeProjectId?: string;
}): AppShellProductConfig {
  const workspaceSuffix = buildWorkspaceSuffix(input);

  return {
    navItems: auditTrailProduct.navItems.map((item) => ({
      href: toWorkspaceScopedHref(item.href, workspaceSuffix),
      id: item.id,
      label: item.label
    })),
    productName: auditTrailProduct.name
  };
}

function buildWorkspaceSuffix(input: {
  activeOrganizationId?: string;
  activeProjectId?: string;
}) {
  if (!input.activeOrganizationId) {
    return "";
  }

  const query = new URLSearchParams({
    organizationId: input.activeOrganizationId
  });

  if (input.activeProjectId) {
    query.set("projectId", input.activeProjectId);
  }

  return `?${query.toString()}`;
}

function toWorkspaceScopedHref(baseHref: string, workspaceSuffix: string) {
  if (!workspaceSuffix || baseHref === "/") {
    return workspaceSuffix ? `/${workspaceSuffix}` : baseHref;
  }

  return `${baseHref}${workspaceSuffix}`;
}
