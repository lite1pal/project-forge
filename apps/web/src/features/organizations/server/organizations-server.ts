import "server-only";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createServerApiClient } from "../../../lib/api/server-api-client";
import { createInvitationsClient } from "../../invitations/api/invitations-client";
import { createOrganizationsClient } from "../api/organizations-client";

export async function loadWorkspacePage(
  searchParams: Record<string, string | string[] | undefined>
) {
  const client = createOrganizationsClient(createServerApiClient());
  const organizations = (await client.listOrganizations()).organizations;
  const activeOrganizationId =
    getSearchValue(searchParams.organizationId) ?? organizations[0]?.id;
  const projects = activeOrganizationId
    ? (await client.listProjects(activeOrganizationId)).projects
    : [];

  const requestHeaders = await headers();

  return {
    activeOrganizationId,
    invitationUrl: buildInvitationUrl(
      getSearchValue(searchParams.invitationToken),
      requestHeaders
    ),
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
