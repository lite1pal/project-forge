import { z } from "zod";

export const todoFieldSchema = z.object({
  title: z.string().trim().min(1),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]),
  dueAt: z.string().datetime().optional()
});

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

export const createTodoInputSchema = z.object({
  title: z.string().trim().min(1),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]),
  dueAt: z.string().datetime().optional()
});

export const updateTodoInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]).optional(),
  dueAt: z.string().datetime().optional()
});

export const listTodosInputSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().trim().min(1).optional()
});

export type TodoRecord = z.infer<typeof todoRecordSchema>;
export type CreateTodoInput = z.infer<typeof createTodoInputSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;
export type ListTodosInput = z.infer<typeof listTodosInputSchema>;
