import { z } from "zod";
import { installedProductStateSchema } from "@auditrail/domain/product";

const onboardingStepSchema = z.object({
  completedAt: z.string().datetime().optional(),
  id: z.enum([
    "project_created",
    "api_key_created",
    "first_event_ingested",
    "member_invited"
  ]),
  required: z.boolean(),
  status: z.enum(["complete", "pending"])
});

const onboardingSummarySchema = z.object({
  completedRequiredSteps: z.number().int(),
  dismissedAt: z.string().datetime().optional(),
  isComplete: z.boolean(),
  isDismissed: z.boolean(),
  steps: z.array(onboardingStepSchema),
  totalRequiredSteps: z.number().int()
});

export const currentUserResponseSchema = z.object({
  memberships: z.array(
    z.object({
      onboarding: onboardingSummarySchema,
      installedProducts: z.array(installedProductStateSchema),
      organization: z.object({
        id: z.string(),
        name: z.string()
      }),
      organizationId: z.string(),
      plan: z.object({
        id: z.enum(["starter", "growth", "scale"]),
        name: z.string(),
        includedEvents: z.number().int(),
        usedEvents: z.number().int(),
        remainingEvents: z.number().int(),
        periodStart: z.string().datetime(),
        periodEnd: z.string().datetime()
      }),
      projectIds: z.array(z.string()),
      projects: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          organizationId: z.string()
        })
      ),
      role: z.enum(["owner", "admin", "member", "viewer"])
    })
  ),
  user: z.object({
    email: z.string().email(),
    id: z.string(),
    name: z.string().optional()
  })
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
