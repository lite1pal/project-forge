import { z } from "zod";

export const customerRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1),
  email: z.string().email(),
  isActive: z.boolean(),
  status: z.enum(["active", "inactive"]),
  externalId: z.string().uuid().optional(),
  lastContactedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type CustomerRecord = z.infer<typeof customerRecordSchema>;
