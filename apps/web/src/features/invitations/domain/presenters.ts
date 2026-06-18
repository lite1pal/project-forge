import type { Invitation } from "@/src/features/invitations/domain/schemas";

export function toInvitationStatus(invitation: Invitation) {
  if (invitation.revokedAt) {
    return "revoked";
  }

  if (invitation.acceptedAt) {
    return "accepted";
  }

  if (invitation.expiresAt < new Date().toISOString()) {
    return "expired";
  }

  return "pending";
}
