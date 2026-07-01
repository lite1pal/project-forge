import { z } from "zod";

export const customerFieldSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  isActive: z.boolean(),
  status: z.enum(["active", "inactive"]),
  externalId: z.string().uuid().optional(),
  lastContactedAt: z.string().datetime().optional()
});

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

export const createCustomerInputSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  isActive: z.boolean(),
  status: z.enum(["active", "inactive"]),
  externalId: z.string().uuid().optional(),
  lastContactedAt: z.string().datetime().optional()
});

export const updateCustomerInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  externalId: z.string().uuid().optional(),
  lastContactedAt: z.string().datetime().optional()
});

export const listCustomersInputSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().trim().min(1).optional()
});

export type CustomerRecord = z.infer<typeof customerRecordSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersInputSchema>;
