import { z } from "zod";

export const todoRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]),
  dueAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type TodoRecord = z.infer<typeof todoRecordSchema>;
