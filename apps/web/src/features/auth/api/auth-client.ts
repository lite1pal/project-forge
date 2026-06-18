import type { ApiClient } from "@/src/lib/api/api-client";
import { currentUserResponseSchema } from "@/src/features/auth/domain/schemas";

export interface AuthClient {
  createSession(input: { email: string; token: string }): Promise<Response>;
  getCurrentUser(): Promise<unknown>;
  logout(): Promise<void>;
  requestMagicLink(email: string): Promise<void>;
}

export function createAuthClient(apiClient: ApiClient): AuthClient {
  return {
    async createSession(input) {
      return apiClient.raw({
        body: input,
        method: "POST",
        path: "/api/v1/auth/sessions"
      });
    },
    getCurrentUser() {
      return apiClient.request({
        path: "/api/v1/me"
      });
    },
    async logout() {
      await apiClient.request({
        method: "DELETE",
        path: "/api/v1/auth/sessions/current"
      });
    },
    async requestMagicLink(email) {
      await apiClient.request({
        body: { email },
        method: "POST",
        path: "/api/v1/auth/magic-links"
      });
    }
  };
}

export async function getCurrentUser(client: AuthClient) {
  return currentUserResponseSchema.parse(await client.getCurrentUser());
}
