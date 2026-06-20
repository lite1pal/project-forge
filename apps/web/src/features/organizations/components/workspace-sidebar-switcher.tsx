"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";

interface WorkspaceSidebarSwitcherProps {
  activeOrganizationId?: string;
  activeProjectId?: string;
  memberships: CurrentUserResponse["memberships"];
}

export function WorkspaceSidebarSwitcher({
  activeOrganizationId,
  activeProjectId,
  memberships
}: WorkspaceSidebarSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initialOrganizationId =
    activeOrganizationId ?? memberships[0]?.organization.id ?? "";
  const initialProjectId =
    activeProjectId ??
    memberships.find((membership) => membership.organization.id === initialOrganizationId)?.projects[0]
      ?.id ??
    "";
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const selectedMembership = memberships.find(
    (membership) => membership.organization.id === organizationId
  );

  function applySelection() {
    if (!organizationId) {
      return;
    }

    const query = new URLSearchParams({
      organizationId
    });

    if (projectId) {
      query.set("projectId", projectId);
    }

    router.push(`${pathname}?${query.toString()}` as Route);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
          Workspace switcher
        </p>
        <p className="text-sm text-[var(--muted)]">
          Change organization and project context without leaving this page.
        </p>
      </div>
      <label className="grid gap-1 text-sm font-bold">
        <span>Organization</span>
        <select
          aria-label="Organization"
          className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] px-3 text-sm font-medium"
          onChange={(event) => {
            const nextOrganizationId = event.target.value;
            const nextProjectId =
              memberships.find(
                (membership) => membership.organization.id === nextOrganizationId
              )?.projects[0]?.id ?? "";

            setOrganizationId(nextOrganizationId);
            setProjectId(nextProjectId);
          }}
          value={organizationId}
        >
          {memberships.map((membership) => (
            <option key={membership.organization.id} value={membership.organization.id}>
              {membership.organization.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold">
        <span>Project</span>
        <select
          aria-label="Project"
          className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] px-3 text-sm font-medium"
          onChange={(event) => {
            setProjectId(event.target.value);
          }}
          value={projectId}
        >
          {(selectedMembership?.projects ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <Button onClick={applySelection} size="sm" type="button" variant="secondary">
        Open workspace
      </Button>
    </div>
  );
}
