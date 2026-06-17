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

export type Invitation = z.infer<typeof invitationSchema>;
