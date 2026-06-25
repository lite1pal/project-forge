import "server-only";

import { redirect } from "next/navigation";

import { toApiError } from "@/src/lib/api/api-errors";
import { ApiError } from "@/src/lib/api/api-errors";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import {
  createAuthClient,
  getCurrentUser,
} from "@/src/features/auth/api/auth-client";

export async function loadCurrentUser() {
  try {
    return await getCurrentUser(createAuthClient(createServerApiClient()));
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === "missing_session"
    ) {
      return undefined;
    }

    throw error;
  }
}

export async function requireCurrentUser() {
  try {
    const user = await loadCurrentUser();

    if (!user) {
      redirect("/auth/sign-in");
    }

    return user;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === "missing_session"
    ) {
      redirect("/auth/sign-in");
    }

    throw error;
  }
}

export async function requestMagicLinkAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  await createAuthClient(createServerApiClient()).requestMagicLink(email);
  redirect(`/auth/magic-link-sent?email=${encodeURIComponent(email)}`);
}
