import "server-only";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { loadServerConfig, type WebServerConfig } from "../../../config/env";
import { createServerApiClient } from "../../../lib/api/server-api-client";
import { createApiKeysClient } from "../../api-keys/api/api-keys-client";
import { createInvitationsClient } from "../../invitations/api/invitations-client";
import { createOrganizationsClient } from "../api/organizations-client";

const apiKeyFlashCookieName = "auditrail_new_api_key";

export async function loadWorkspacePage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: {
    apiKeysClient?: ReturnType<typeof createApiKeysClient>;
    config?: WebServerConfig;
    cookieStore?: {
      get(name: string): { value: string } | undefined;
    };
    organizationsClient?: ReturnType<typeof createOrganizationsClient>;
    requestHeaders?: Headers;
  } = {}
) {
  const organizationsClient =
    dependencies.organizationsClient ??
    createOrganizationsClient(createServerApiClient());
  const apiKeysClient =
    dependencies.apiKeysClient ?? createApiKeysClient(createServerApiClient());
  const config = dependencies.config ?? loadServerConfig();
  const cookieStore = dependencies.cookieStore ?? (await cookies());
  const requestHeaders = dependencies.requestHeaders ?? (await headers());
  const organizations = (await organizationsClient.listOrganizations()).organizations;
  const activeOrganizationId =
    getSearchValue(searchParams.organizationId) ?? organizations[0]?.id;
  const projects = activeOrganizationId
    ? (await organizationsClient.listProjects(activeOrganizationId)).projects
    : [];
  const requestedProjectId = getSearchValue(searchParams.projectId);
  const activeProjectId =
    projects.find((project) => project.id === requestedProjectId)?.id ??
    projects[0]?.id;
  const apiKeys =
    activeOrganizationId && activeProjectId
      ? (
          await apiKeysClient.listApiKeys(activeOrganizationId, activeProjectId)
        ).apiKeys
      : [];
  const newApiKey = parseApiKeyFlash(cookieStore.get(apiKeyFlashCookieName)?.value);
  const activeProject = projects.find((project) => project.id === activeProjectId);

  return {
    activeOrganizationId,
    activeProjectId,
    apiKeys,
    ingestCommand: buildIngestCommand({
      apiBaseUrl: config.WEB_API_BASE_URL,
      projectName: activeProject?.name,
      rawKey:
        newApiKey?.projectId === activeProjectId ? newApiKey.rawKey : undefined
    }),
    invitationUrl: buildInvitationUrl(
      getSearchValue(searchParams.invitationToken),
      requestHeaders
    ),
    newApiKey,
    organizations,
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
      projectId?: string;
      rawKey?: string;
    };

    if (!parsed.name || !parsed.projectId || !parsed.rawKey) {
      return undefined;
    }

    return {
      name: parsed.name,
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
