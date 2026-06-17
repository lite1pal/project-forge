import { z } from "zod";

export const invitationSchema = z.object({
  acceptedAt: z.string().datetime({ offset: true }).optional(),
  email: z.string().email(),
  expiresAt: z.string().datetime({ offset: true }),
  id: z.string(),
  organizationId: z.string(),
  revokedAt: z.string().datetime({ offset: true }).optional(),
  role: z.enum(["owner", "admin", "member", "viewer"])
});

export const inviteMemberResponseSchema = z.object({
  invitation: invitationSchema,
  token: z.string()
});

export const acceptInvitationResponseSchema = z.object({
  membership: z.object({
    id: z.string(),
    organizationId: z.string(),
    role: z.enum(["owner", "admin", "member", "viewer"]),
    userId: z.string()
  })
});

export type Invitation = z.infer<typeof invitationSchema>;
