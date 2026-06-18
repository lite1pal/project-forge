import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadServerConfig } from "@/src/config/env";
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

export async function createSessionAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("token") ?? "");
  const response = await createAuthClient(
    createServerApiClient(),
  ).createSession({
    email,
    token,
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
  (await cookies()).delete(loadServerConfig().AUTH_SESSION_COOKIE_NAME);
  redirect("/auth/sign-in");
}

async function setSessionCookie(setCookie: string) {
  const cookie = parseSetCookie(setCookie);

  if (!cookie) {
    return undefined;
  }

  const store = await cookies();

  store.set(cookie.name, cookie.value, {
    httpOnly: true,
    maxAge: cookie.maxAge,
    path: cookie.path,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
  });
}

function parseSetCookie(setCookie: string) {
  const [cookiePair, ...attributes] = setCookie.split(";").map((part) => part.trim());

  if (!cookiePair) {
    return undefined;
  }

  const separatorIndex = cookiePair.indexOf("=");

  if (separatorIndex === -1) {
    return undefined;
  }

  const name = cookiePair.slice(0, separatorIndex);
  const value = cookiePair.slice(separatorIndex + 1);
  let maxAge: number | undefined;
  let path = "/";
  let sameSite: "lax" | "strict" | "none" = "lax";
  let secure = process.env.NODE_ENV === "production";

  for (const attribute of attributes) {
    const [rawKey, rawValue] = attribute.split("=");
    const key = rawKey?.toLowerCase();

    if (key === "max-age" && rawValue) {
      const parsedValue = Number(rawValue);

      if (!Number.isNaN(parsedValue)) {
        maxAge = parsedValue;
      }
    }

    if (key === "path" && rawValue) {
      path = rawValue;
    }

    if (key === "samesite" && rawValue) {
      const normalized = rawValue.toLowerCase();

      if (
        normalized === "lax" ||
        normalized === "strict" ||
        normalized === "none"
      ) {
        sameSite = normalized;
      }
    }

    if (key === "secure") {
      secure = true;
    }
  }

  return {
    maxAge,
    name,
    path,
    sameSite,
    secure,
    value
  };
}
