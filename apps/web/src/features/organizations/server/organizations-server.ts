import "server-only";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { loadServerConfig, type WebServerConfig } from "@/src/config/env";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { createApiKeysClient } from "@/src/features/api-keys/api/api-keys-client";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import { createInvitationsClient } from "@/src/features/invitations/api/invitations-client";
import { createOrganizationsClient } from "@/src/features/organizations/api/organizations-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";

const apiKeyFlashCookieName = "auditrail_new_api_key";

export async function loadWorkspacePage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: {
    apiKeysClient?: ReturnType<typeof createApiKeysClient>;
    config?: WebServerConfig;
    currentUser: CurrentUserResponse;
    cookieStore?: {
      get(name: string): { value: string } | undefined;
      delete?(name: string): void;
    };
    requestHeaders?: Headers;
  }
) {
  const apiKeysClient =
    dependencies.apiKeysClient ?? createApiKeysClient(createServerApiClient());
  const config = dependencies.config ?? loadServerConfig();
  const cookieStore = dependencies.cookieStore ?? (await cookies());
  const requestHeaders = dependencies.requestHeaders ?? (await headers());
  const workspace = resolveWorkspaceContext(dependencies.currentUser, {
    organizationId: getSearchValue(searchParams.organizationId),
    projectId: getSearchValue(searchParams.projectId)
  });
  const activeOrganizationId = workspace.activeOrganizationId;
  const activeProjectId = workspace.activeProjectId;
  const projects = workspace.projects;
  const apiKeys =
    activeOrganizationId && activeProjectId
      ? (
          await apiKeysClient.listApiKeys(activeOrganizationId, activeProjectId)
        ).apiKeys
      : [];
  const flashedApiKey = parseApiKeyFlash(
    cookieStore.get(apiKeyFlashCookieName)?.value
  );
  if (flashedApiKey) {
    cookieStore.delete?.(apiKeyFlashCookieName);
  }
  const activeProject = workspace.activeProject;
  const activeProjectApiKey =
    flashedApiKey &&
    flashedApiKey.organizationId === activeOrganizationId &&
    flashedApiKey.projectId === activeProjectId
      ? flashedApiKey
      : undefined;

  return {
    activeOrganizationId,
    activeProjectId,
    apiKeys,
    ingestCommand: buildIngestCommand({
      apiBaseUrl: config.WEB_API_BASE_URL,
      projectName: activeProject?.name,
      rawKey: activeProjectApiKey?.rawKey
    }),
    invitationUrl: buildInvitationUrl(
      getSearchValue(searchParams.invitationToken),
      requestHeaders
    ),
    newApiKey: activeProjectApiKey,
    organizations: workspace.organizations,
    projects
  };
}

export async function createOrganizationAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "");
  const result = await createOrganizationsClient(
    createServerApiClient()
  ).createOrganization(name);

  revalidatePath("/");
  revalidatePath("/settings");
  redirect(`/settings?organizationId=${result.organization.id}`);
}

export async function createProjectAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "");

  await createOrganizationsClient(createServerApiClient()).createProject(
    organizationId,
    name
  );

  revalidatePath("/");
  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}`);
}

export async function createApiKeyAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "");
  const result = await createApiKeysClient(createServerApiClient()).createApiKey(
    organizationId,
    projectId,
    name
  );
  const cookieStore = await cookies();

  cookieStore.set(
    apiKeyFlashCookieName,
    JSON.stringify({
      name: result.apiKey.name,
      organizationId,
      projectId,
      rawKey: result.rawKey
    }),
    {
      httpOnly: true,
      maxAge: 60 * 5,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  );

  revalidatePath("/");
  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}&projectId=${projectId}`);
}

export async function revokeApiKeyAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const apiKeyId = String(formData.get("apiKeyId") ?? "");

  await createApiKeysClient(createServerApiClient()).revokeApiKey(
    organizationId,
    projectId,
    apiKeyId
  );

  revalidatePath("/");
  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}&projectId=${projectId}`);
}

export async function inviteMemberAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const role = String(formData.get("role") ?? "member") as
    | "admin"
    | "member"
    | "viewer";
  const result = await createInvitationsClient(createServerApiClient()).inviteMember({
    email,
    organizationId,
    role
  });

  revalidatePath("/settings");
  redirect(
    `/settings?organizationId=${organizationId}&invitationToken=${result.token}`
  );
}

export async function acceptInvitationAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  await createInvitationsClient(createServerApiClient()).acceptInvitation(token);

  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings");
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildInvitationUrl(token: string | undefined, requestHeaders: Headers) {
  if (!token) {
    return undefined;
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const path = `/settings?invitationToken=${encodeURIComponent(token)}`;

  return host ? `${protocol}://${host}${path}` : path;
}

function parseApiKeyFlash(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as {
      name?: string;
      organizationId?: string;
      projectId?: string;
      rawKey?: string;
    };

    if (
      !parsed.name ||
      !parsed.organizationId ||
      !parsed.projectId ||
      !parsed.rawKey
    ) {
      return undefined;
    }

    return {
      name: parsed.name,
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      rawKey: parsed.rawKey
    };
  } catch {
    return undefined;
  }
}

function buildIngestCommand(input: {
  apiBaseUrl: string;
  projectName?: string;
  rawKey?: string;
}) {
  if (!input.projectName) {
    return undefined;
  }

  return [
    `curl -i ${input.apiBaseUrl}/api/v1/events \\`,
    "  -H 'content-type: application/json' \\",
    `  -H 'authorization: Bearer ${input.rawKey ?? "<YOUR_API_KEY>"}' \\`,
    `  -d '{"event":"${slugifyEventName(input.projectName)}.tested","actor":"setup-script","target":"first-event","metadata":{"source":"mvp-onboarding"}}'`
  ].join("\n");
}

function slugifyEventName(projectName: string) {
  return projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".");
}
