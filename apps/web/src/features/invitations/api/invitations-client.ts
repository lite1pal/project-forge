import type { ApiClient } from "@/src/lib/api/api-client";
import {
  acceptInvitationResponseSchema,
  inviteMemberResponseSchema
} from "@/src/features/invitations/domain/schemas";

export function createInvitationsClient(apiClient: ApiClient) {
  return {
    async acceptInvitation(token: string) {
      return acceptInvitationResponseSchema.parse(
        await apiClient.request({
          body: { token },
          method: "POST",
          path: "/api/v1/invitations/accept"
        })
      );
    },
    async inviteMember(input: {
      email: string;
      organizationId: string;
      role: "admin" | "member" | "viewer";
    }) {
      return inviteMemberResponseSchema.parse(
        await apiClient.request({
          body: {
            email: input.email,
            role: input.role
          },
          method: "POST",
          path: `/api/v1/organizations/${input.organizationId}/invitations`
        })
      );
    }
  };
}
