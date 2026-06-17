import { z } from "zod";

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string()
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string()
});

export const membershipSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
  userId: z.string()
});

export type Organization = z.infer<typeof organizationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Membership = z.infer<typeof membershipSchema>;
