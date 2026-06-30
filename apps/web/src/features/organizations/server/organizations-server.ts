import "server-only";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { loadServerConfig, type WebServerConfig } from "@/src/config/env";
import { ApiError } from "@/src/lib/api/api-errors";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { createApiKeysClient } from "@/src/features/api-keys/api/api-keys-client";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import { createInvitationsClient } from "@/src/features/invitations/api/invitations-client";
import { createBillingClient } from "@/src/features/organizations/api/billing-client";
import { createOrganizationsClient } from "@/src/features/organizations/api/organizations-client";
import { createProjectWebhooksClient } from "@/src/features/organizations/api/project-webhooks-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import type { WorkspaceBillingActionState } from "@/src/features/organizations/components/workspace-settings-screen.types";

const apiKeyFlashCookieName = "auditrail_new_api_key";
const webhookSecretFlashCookieName = "auditrail_webhook_secret";

export async function loadWorkspacePage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: {
    apiKeysClient?: ReturnType<typeof createApiKeysClient>;
    billingClient?: ReturnType<typeof createBillingClient>;
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
  const billingClient =
    dependencies.billingClient ?? createBillingClient(createServerApiClient());
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
  const canManageProjectWebhooks =
    workspace.activeOrganizationRole === "owner" ||
    workspace.activeOrganizationRole === "admin";
  const billingStatus = activeOrganizationId
    ? await billingClient.getBillingStatus(activeOrganizationId)
    : undefined;
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
  const webhooksClient = createProjectWebhooksClient(createServerApiClient());
  const projectWebhooks =
    activeOrganizationId && activeProjectId && canManageProjectWebhooks
      ? (
          await webhooksClient.listWebhooks(
            activeOrganizationId,
            activeProjectId
          )
        ).endpoints
      : [];
  const activeProjectApiKey =
    flashedApiKey &&
    flashedApiKey.organizationId === activeOrganizationId &&
    flashedApiKey.projectId === activeProjectId
      ? flashedApiKey
      : undefined;
  const flashedWebhookSecret = parseWebhookSecretFlash(
    cookieStore.get(webhookSecretFlashCookieName)?.value
  );

  if (flashedWebhookSecret) {
    cookieStore.delete?.(webhookSecretFlashCookieName);
  }
  const activeProjectWebhookSecret =
    flashedWebhookSecret &&
    flashedWebhookSecret.organizationId === activeOrganizationId &&
    flashedWebhookSecret.projectId === activeProjectId
      ? {
          endpointId: flashedWebhookSecret.endpointId,
          secret: flashedWebhookSecret.secret
        }
      : undefined;

  return {
    activeOrganizationId,
    billingStatus,
    activeOrganizationPlan: workspace.activeOrganizationPlan,
    activeOrganizationRole: workspace.activeOrganizationRole,
    activeProjectId,
    activeProjectWebhookSecret,
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
    projectWebhooks,
    projects
  };
}

export async function loadOrganizationMembersPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: {
    currentUser: CurrentUserResponse;
    organizationsClient?: ReturnType<typeof createOrganizationsClient>;
  }
) {
  const organizationsClient =
    dependencies.organizationsClient ??
    createOrganizationsClient(createServerApiClient());
  const workspace = resolveWorkspaceContext(dependencies.currentUser, {
    organizationId: getSearchValue(searchParams.organizationId),
    projectId: getSearchValue(searchParams.projectId)
  });
  const members = workspace.activeOrganizationId
    ? (await organizationsClient.listMembers(workspace.activeOrganizationId)).members
    : [];

  return {
    activeOrganizationId: workspace.activeOrganizationId,
    activeProjectId: workspace.activeProjectId,
    members
  };
}

export async function createOrganizationAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "");
  const result = await createOrganizationsClient(
    createServerApiClient()
  ).createOrganization(name);

  revalidatePath("/");
  revalidatePath("/getting-started");
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
  revalidatePath("/getting-started");
  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}`);
}

export async function changeOrganizationPlanAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const planId = String(formData.get("planId") ?? "") as
    | "starter"
    | "growth"
    | "scale";

  await createOrganizationsClient(createServerApiClient()).changePlan(
    organizationId,
    planId
  );

  revalidatePath("/");
  revalidatePath("/getting-started");
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
  revalidatePath("/getting-started");
  revalidatePath("/settings");
  const targetPath = getWorkspaceRedirectTarget(formData);

  revalidatePath(targetPath);
  redirect(
    `${targetPath}?organizationId=${organizationId}&projectId=${projectId}` as Route
  );
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
  revalidatePath("/getting-started");
  revalidatePath("/settings");
  const targetPath = getWorkspaceRedirectTarget(formData);

  revalidatePath(targetPath);
  redirect(
    `${targetPath}?organizationId=${organizationId}&projectId=${projectId}` as Route
  );
}

export async function revokeApiKeyActionById(input: {
  apiKeyId: string;
  organizationId: string;
  projectId: string;
  redirectTo?: "/api-keys" | "/settings";
}) {
  "use server";

  await createApiKeysClient(createServerApiClient()).revokeApiKey(
    input.organizationId,
    input.projectId,
    input.apiKeyId
  );

  revalidatePath("/");
  revalidatePath("/getting-started");
  revalidatePath("/settings");

  const targetPath = input.redirectTo === "/api-keys" ? "/api-keys" : "/settings";

  revalidatePath(targetPath);
  redirect(
    `${targetPath}?organizationId=${input.organizationId}&projectId=${input.projectId}` as Route
  );
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

  revalidatePath("/getting-started");
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
  revalidatePath("/getting-started");
  revalidatePath("/settings");
  redirect("/settings");
}

export async function requestBillingCheckoutAction(
  _previousState: WorkspaceBillingActionState,
  formData: FormData
) {
  "use server";

  return submitBillingCheckout(
    {
      organizationId: String(formData.get("organizationId") ?? ""),
      planId: String(formData.get("planId") ?? ""),
      priceId: getOptionalFormValue(formData.get("priceId"))
    },
    {
      billingClient: createBillingClient(createServerApiClient()),
      requestHeaders: await headers()
    }
  );
}

export async function requestBillingPortalAction(
  _previousState: WorkspaceBillingActionState,
  formData: FormData
) {
  "use server";

  return submitBillingPortal(
    {
      organizationId: String(formData.get("organizationId") ?? "")
    },
    {
      billingClient: createBillingClient(createServerApiClient()),
      requestHeaders: await headers()
    }
  );
}

export async function createProjectWebhookAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const url = String(formData.get("url") ?? "");
  const subscribedEventTypes = getWebhookSubscriptionFormValues(formData);
  const result = await createProjectWebhooksClient(
    createServerApiClient()
  ).createWebhook(organizationId, projectId, {
    subscribedEventTypes,
    url
  });
  const cookieStore = await cookies();

  cookieStore.set(
    webhookSecretFlashCookieName,
    JSON.stringify({
      endpointId: result.endpoint.id,
      organizationId,
      projectId,
      secret: result.secret
    }),
    {
      httpOnly: true,
      maxAge: 60 * 5,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  );

  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}&projectId=${projectId}`);
}

export async function updateProjectWebhookAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const endpointId = String(formData.get("endpointId") ?? "");
  const url = getOptionalFormValue(formData.get("url"));

  await createProjectWebhooksClient(createServerApiClient()).updateWebhook(
    organizationId,
    projectId,
    endpointId,
    {
      enabled: formData.get("enabled") === "on",
      subscribedEventTypes: getWebhookSubscriptionFormValues(formData),
      url
    }
  );

  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}&projectId=${projectId}`);
}

export async function rotateProjectWebhookSecretAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const endpointId = String(formData.get("endpointId") ?? "");
  const result = await createProjectWebhooksClient(
    createServerApiClient()
  ).rotateSecret(organizationId, projectId, endpointId);
  const cookieStore = await cookies();

  cookieStore.set(
    webhookSecretFlashCookieName,
    JSON.stringify({
      endpointId,
      organizationId,
      projectId,
      secret: result.secret
    }),
    {
      httpOnly: true,
      maxAge: 60 * 5,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  );

  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}&projectId=${projectId}`);
}

export async function deleteProjectWebhookAction(formData: FormData) {
  "use server";

  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const endpointId = String(formData.get("endpointId") ?? "");

  await createProjectWebhooksClient(createServerApiClient()).deleteWebhook(
    organizationId,
    projectId,
    endpointId
  );

  revalidatePath("/settings");
  redirect(`/settings?organizationId=${organizationId}&projectId=${projectId}`);
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function submitBillingCheckout(
  input: {
    organizationId: string;
    planId: string;
    priceId?: string;
  },
  dependencies: {
    billingClient: ReturnType<typeof createBillingClient>;
    requestHeaders: Headers;
  }
): Promise<WorkspaceBillingActionState> {
  if (!input.organizationId || !input.planId) {
    return createBillingActionError(
      "Billing checkout is unavailable until an organization billing context is selected."
    );
  }

  try {
    const settingsUrl = buildSettingsUrl(
      input.organizationId,
      dependencies.requestHeaders
    );

    const result = await dependencies.billingClient.createCheckoutIntent(
      input.organizationId,
      {
      cancelUrl: settingsUrl,
      planId: input.planId,
      priceId: input.priceId,
      successUrl: settingsUrl
      }
    );

    return {
      redirectUrl: result.url,
      status: "success"
    };
  } catch (error) {
    return mapBillingActionError(error, "Billing checkout is not connected yet.");
  }
}

export async function submitBillingPortal(
  input: {
    organizationId: string;
  },
  dependencies: {
    billingClient: ReturnType<typeof createBillingClient>;
    requestHeaders: Headers;
  }
): Promise<WorkspaceBillingActionState> {
  if (!input.organizationId) {
    return createBillingActionError(
      "Billing portal is unavailable until an organization billing context is selected."
    );
  }

  try {
    const result = await dependencies.billingClient.createPortalIntent(
      input.organizationId,
      {
      returnUrl: buildSettingsUrl(input.organizationId, dependencies.requestHeaders)
      }
    );

    return {
      redirectUrl: result.url,
      status: "success"
    };
  } catch (error) {
    return mapBillingActionError(error, "Billing portal is not connected yet.");
  }
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

function buildSettingsUrl(organizationId: string, requestHeaders: Headers) {
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const path = `/settings?organizationId=${encodeURIComponent(organizationId)}`;

  return host ? `${protocol}://${host}${path}` : path;
}

function createBillingActionError(message: string): WorkspaceBillingActionState {
  return {
    message,
    status: "error"
  };
}

function mapBillingActionError(
  error: unknown,
  fallbackMessage: string
): WorkspaceBillingActionState {
  if (
    error instanceof ApiError &&
    error.code === "billing_provider_not_configured"
  ) {
    return createBillingActionError(fallbackMessage);
  }

  if (error instanceof ApiError && error.code === "forbidden") {
    return createBillingActionError(
      "Only organization owners and admins can manage billing actions."
    );
  }

  if (error instanceof ApiError && error.code === "billing_customer_not_found") {
    return createBillingActionError(
      "Billing portal is unavailable until this organization has a billing customer."
    );
  }

  throw error;
}

function getOptionalFormValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");

  return raw.length > 0 ? raw : undefined;
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

function parseWebhookSecretFlash(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as {
      endpointId?: string;
      organizationId?: string;
      projectId?: string;
      secret?: string;
    };

    if (
      !parsed.endpointId ||
      !parsed.organizationId ||
      !parsed.projectId ||
      !parsed.secret
    ) {
      return undefined;
    }

    return {
      endpointId: parsed.endpointId,
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      secret: parsed.secret
    };
  } catch {
    return undefined;
  }
}

function getWebhookSubscriptionFormValues(formData: FormData) {
  const deliverAuditEvents = formData.get("deliverAuditEventCreated") === "on";

  return deliverAuditEvents ? ["audit.event.created"] : [];
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

function getWorkspaceRedirectTarget(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "");

  return redirectTo === "/api-keys" ? "/api-keys" : "/settings";
}
