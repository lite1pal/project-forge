import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTodoInputSchema, updateTodoInputSchema } from "@auditrail/domain/generated/todo";

import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { createResourceClient } from "@/src/features/todo/api/todo-client";

export async function loadTodoWorkspacePage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: {
    currentUser: CurrentUserResponse;
  }
) {
  const workspace = resolveWorkspaceContext(
    dependencies.currentUser,
    {
      organizationId: getSearchValue(searchParams.organizationId),
      projectId: getSearchValue(searchParams.projectId)
    },
    {
      requiredProductId: "todo"
    }
  );
  const items = workspace.activeOrganizationId
    ? (await createResourceClient(createServerApiClient()).list(
        workspace.activeOrganizationId
      )).items
    : [];

  return {
    items,
    workspace
  };
}

export async function loadTodoWorkspaceDetailPage(
  input: {
    todoId: string;
    searchParams: Record<string, string | string[] | undefined>;
  },
  dependencies: {
    currentUser: CurrentUserResponse;
  }
) {
  const workspace = resolveWorkspaceContext(
    dependencies.currentUser,
    {
      organizationId: getSearchValue(input.searchParams.organizationId),
      projectId: getSearchValue(input.searchParams.projectId)
    },
    {
      requiredProductId: "todo"
    }
  );
  const item = workspace.activeOrganizationId
    ? await createResourceClient(createServerApiClient()).get(
        workspace.activeOrganizationId,
        input.todoId
      )
    : null;

  return {
    item,
    workspace
  };
}

export async function createTodoWorkspaceAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));

  const payload = createTodoInputSchema.parse({
    title: String(formData.get("title") ?? ""),
    details: coerceString(formData.get("details")),
    status: String(formData.get("status") ?? ""),
    dueAt: coerceDatetime(formData.get("dueAt")),
  });

  await createResourceClient(createServerApiClient()).create(
    organizationId,
    payload
  );

  const nextPath = "/todo/todos" + buildWorkspaceSuffix(organizationId, projectId);
  revalidatePath(nextPath);
  redirect(nextPath as never);
}

export async function updateTodoWorkspaceAction(formData: FormData) {
  "use server";

  const todoId = String(formData.get("todoId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));

  const payload = updateTodoInputSchema.parse({
    title: String(formData.get("title") ?? ""),
    details: coerceString(formData.get("details")),
    status: String(formData.get("status") ?? ""),
    dueAt: coerceDatetime(formData.get("dueAt")),
  });

  await createResourceClient(createServerApiClient()).update(
    organizationId,
    todoId,
    payload
  );

  const nextPath = buildResourcePath("/todo/todos", todoId, organizationId, projectId);
  const listPath = "/todo/todos" + buildWorkspaceSuffix(organizationId, projectId);
  revalidatePath(nextPath);
  revalidatePath(listPath);
  redirect(nextPath as never);
}

function buildWorkspaceSuffix(
  organizationId: string,
  projectId?: string
) {
  const query = new URLSearchParams({ organizationId });

  if (projectId) {
    query.set("projectId", projectId);
  }

  return `?${query.toString()}`;
}

function buildResourcePath(
  basePath: string,
  id: string,
  organizationId: string,
  projectId?: string
) {
  return `${basePath}/${id}${buildWorkspaceSuffix(organizationId, projectId)}`;
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function coerceString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceDatetime(value: FormDataEntryValue | null) {
  const trimmed = coerceString(value);

  return trimmed ? new Date(trimmed).toISOString() : undefined;
}

function coerceBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}
