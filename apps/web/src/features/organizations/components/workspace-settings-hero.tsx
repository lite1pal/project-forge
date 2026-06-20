import type { UrlObject } from "url";

import { OrganizationSwitcher } from "@/src/features/organizations/components/organization-switcher";
import { WorkspaceSummaryCard } from "@/src/features/organizations/components/workspace-summary-card";
import type { Organization, Project } from "@/src/features/organizations/domain/schemas";

interface WorkspaceSettingsHeroProps {
  activeOrganizationId?: string;
  activeProject?: Project;
  apiKeyCount: number;
  dashboardHref: UrlObject;
  organizations: Organization[];
  projects: Project[];
}

export function WorkspaceSettingsHero({
  activeOrganizationId,
  activeProject,
  apiKeyCount,
  dashboardHref,
  organizations,
  projects
}: WorkspaceSettingsHeroProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_360px]">
      <div className="grid gap-4">
        <div className="grid gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Workspace settings
          </p>
          <h1 className="text-3xl leading-tight font-bold">
            Manage organizations, projects, and ingest keys from one place.
          </h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            Switch workspace context, invite teammates, and generate the first event path
            without leaving the page.
          </p>
        </div>
        <OrganizationSwitcher
          activeOrganizationId={activeOrganizationId}
          organizations={organizations}
        />
      </div>
      <WorkspaceSummaryCard
        activeOrganizationName={
          organizations.find((organization) => organization.id === activeOrganizationId)?.name
        }
        activeProjectName={activeProject?.name}
        apiKeyCount={apiKeyCount}
        dashboardHref={dashboardHref}
        organizationCount={organizations.length}
        projectCount={projects.length}
      />
    </section>
  );
}
