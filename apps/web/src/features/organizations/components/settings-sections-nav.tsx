import { Card } from "@/src/components/ui/card";
import type { WorkspaceSettingsPlanUsageCopy } from "@/src/features/organizations/components/workspace-settings-screen.types";

export function SettingsSectionsNav({
  planUsage
}: {
  planUsage: WorkspaceSettingsPlanUsageCopy;
}) {
  const sectionLinks = [
    {
      description: "Switch organizations and create the workspace shell.",
      href: "#workspace-settings",
      label: "Workspace"
    },
    {
      description: planUsage.navDescription,
      href: "#plan-settings",
      label: planUsage.navLabel
    },
    {
      description: "Review billing state and retry checkout or portal actions.",
      href: "#billing-settings",
      label: "Billing"
    },
    {
      description: "Handle invitations and teammate access.",
      href: "#access-settings",
      label: "Access"
    },
    {
      description: "Select or create projects for the current organization.",
      href: "#project-settings",
      label: "Projects"
    }
  ];

  return (
    <Card className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
          Settings map
        </p>
        <h2 className="text-lg font-bold">Jump to the workspace area you need.</h2>
        <p className="text-sm text-[var(--muted)]">
          Keep organization setup, access management, and project work separated.
        </p>
      </div>
      <nav aria-label="Settings sections">
        <ul className="grid gap-2">
          {sectionLinks.map((section) => (
            <li key={section.href}>
              <a
                className="grid gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-3 transition-colors hover:bg-[var(--panel)]"
                href={section.href}
              >
                <span className="text-sm font-bold text-[var(--foreground)]">
                  {section.label}
                </span>
                <span className="text-xs text-[var(--muted)]">{section.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  );
}
