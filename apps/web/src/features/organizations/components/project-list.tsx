import Link from "next/link";

import { Card } from "../../../components/ui/card";
import type { Project } from "../domain/schemas";

interface ProjectListProps {
  activeProjectId?: string;
  organizationId?: string;
  projects: Project[];
}

export function ProjectList({
  activeProjectId,
  organizationId,
  projects
}: ProjectListProps) {
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Projects</h2>
        <p className="text-sm text-[var(--muted)]">
          Projects available in the selected organization.
        </p>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No projects yet.</p>
      ) : (
        <ul className="grid gap-2">
          {projects.map((project) => (
            <li
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              key={project.id}
            >
              <Link
                className="grid gap-1"
                href={
                  organizationId
                    ? `/settings?organizationId=${organizationId}&projectId=${project.id}`
                    : "/settings"
                }
              >
                <strong>
                  {project.name}
                  {project.id === activeProjectId ? " (selected)" : ""}
                </strong>
                <p className="text-xs text-[var(--muted)]">{project.id}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
