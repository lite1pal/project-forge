import "server-only";

import { revalidatePath } from "next/cache";

import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { createOnboardingClient } from "@/src/features/onboarding/api/onboarding-client";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { loadWorkspacePage } from "@/src/features/organizations/server/organizations-server";

export async function loadOnboardingPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: {
    currentUser: CurrentUserResponse;
    productId?: string;
  }
) {
  const workspace = await loadWorkspacePage(searchParams, {
    currentUser: dependencies.currentUser,
    productId: dependencies.productId
  });
  const resolvedWorkspace = resolveWorkspaceContext(dependencies.currentUser, {
    organizationId: getSearchValue(searchParams.organizationId),
    projectId: getSearchValue(searchParams.projectId)
  }, {
    requiredProductId: dependencies.productId
  });

  return {
    activeOnboarding: resolvedWorkspace.activeOrganizationOnboarding,
    activeOrganizationId: workspace.activeOrganizationId,
    activeOrganizationName: resolvedWorkspace.activeOrganization?.name,
    activeProjectId: workspace.activeProjectId,
    activeProjectName: resolvedWorkspace.activeProject?.name,
    ingestCommand: workspace.ingestCommand,
    organizations: workspace.organizations
  };
}

export async function updateOnboardingStateAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const dismissed = String(formData.get("dismissed") ?? "false") === "true";

  await createOnboardingClient(createServerApiClient()).updateOnboardingState(
    organizationId,
    dismissed
  );

  revalidatePath("/getting-started");
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/api-keys");
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
