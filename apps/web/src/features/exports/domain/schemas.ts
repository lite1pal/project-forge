import { z } from "zod";

export const exportJobSchema = z.object({
  error: z.string().optional(),
  id: z.string(),
  objectKey: z.string().optional(),
  organizationId: z.string(),
  projectId: z.string(),
  requestedByUserId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"])
});

export type ExportJob = z.infer<typeof exportJobSchema>;
