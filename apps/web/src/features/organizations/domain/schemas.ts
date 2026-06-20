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

export const organizationMemberSchema = z.object({
  email: z.string().email(),
  id: z.string(),
  name: z.string().optional(),
  role: z.enum(["owner", "admin", "member", "viewer"])
});

export const organizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema)
});

export const createOrganizationResponseSchema = z.object({
  membership: membershipSchema,
  organization: organizationSchema
});

export const projectsResponseSchema = z.object({
  projects: z.array(projectSchema)
});

export const createProjectResponseSchema = z.object({
  project: projectSchema
});

export const organizationMembersResponseSchema = z.object({
  members: z.array(organizationMemberSchema)
});

export type Organization = z.infer<typeof organizationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
