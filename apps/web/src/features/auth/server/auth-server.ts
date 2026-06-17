import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { toApiError } from "../../../lib/api/api-errors";
import { createServerApiClient } from "../../../lib/api/server-api-client";
import { createAuthClient, getCurrentUser } from "../api/auth-client";

export async function loadCurrentUser() {
  try {
    return await getCurrentUser(createAuthClient(createServerApiClient()));
  } catch {
    return undefined;
  }
}

export async function requireCurrentUser() {
  const user = await loadCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return user;
}

export async function requestMagicLinkAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  await createAuthClient(createServerApiClient()).requestMagicLink(email);
  redirect(`/auth/magic-link-sent?email=${encodeURIComponent(email)}`);
}

export async function createSessionAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("token") ?? "");
  const response = await createAuthClient(createServerApiClient()).createSession({
    email,
    token
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  const setCookie = response.headers.get("set-cookie");

  if (setCookie) {
    await setSessionCookie(setCookie);
  }

  redirect("/");
}

export async function logoutAction() {
  "use server";

  await createAuthClient(createServerApiClient()).logout();
  (await cookies()).delete("auditrail_session");
  redirect("/auth/sign-in");
}

async function setSessionCookie(setCookie: string) {
  const [cookiePair] = setCookie.split(";");
  if (!cookiePair) {
    return;
  }

  const [name, value] = cookiePair.split("=");
  if (!name || !value) {
    return;
  }

  const store = await cookies();

  store.set(name, value, {
    httpOnly: true,
    path: "/",
    sameSite: "lax"
  });
}
