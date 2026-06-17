import "server-only";

import { cookies } from "next/headers";

import { loadServerConfig } from "../../config/env";
import { createApiClient, type ApiClient } from "./api-client";

export function createServerApiClient(): ApiClient {
  const config = loadServerConfig();

  return createApiClient({
    baseUrl: config.WEB_API_BASE_URL,
    getCookieHeader: async () => (await cookies()).toString(),
    getAccessToken: async () => config.WEB_API_KEY
  });
}
