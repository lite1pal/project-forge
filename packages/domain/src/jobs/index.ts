import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);

export const jobNames = [
  "audit-event.created",
  "billing.webhook.received",
  "email.delivery.requested",
  "project.webhook.deliver"
] as const;

export type JobName = (typeof jobNames)[number];

export const jobStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled"
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export type JobPayloadValue =
  | boolean
  | null
  | number
  | string
  | JobPayload
  | JobPayloadValue[];

export interface JobPayload {
  [key: string]: JobPayloadValue;
}

export interface JobEnvelope<
  TName extends JobName = JobName,
  TStatus extends JobStatus = JobStatus,
  TPayload extends JobPayload = JobPayload
> {
  id: string;
  name: TName;
  payload: TPayload;
  status: TStatus;
}

export const jobNameSchema = z.enum(jobNames);

export const jobStatusSchema = z.enum(jobStatuses);

export const jobPayloadValueSchema: z.ZodType<JobPayloadValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jobPayloadValueSchema),
    z.record(z.string(), jobPayloadValueSchema)
  ])
);

export const jobPayloadSchema = z.record(
  z.string(),
  jobPayloadValueSchema
) satisfies z.ZodType<JobPayload>;

export const jobEnvelopeSchema = z.object({
  id: nonEmptyStringSchema,
  name: jobNameSchema,
  payload: jobPayloadSchema,
  status: jobStatusSchema
}) satisfies z.ZodType<JobEnvelope>;
