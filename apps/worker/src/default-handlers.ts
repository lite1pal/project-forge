import type { Database } from "@auditrail/db";

import type { RegisteredJobHandler } from "./handlers.js";
import { createProjectWebhookDeliveryHandler } from "./project-webhook-delivery.js";
import type { WorkerLogger } from "./worker.js";

export function createDefaultJobHandlers(
  options:
    | {
        db: Database;
        logger?: Pick<WorkerLogger, "info" | "warn">;
        retryDelayMs: number;
      }
    | Pick<WorkerLogger, "info">
): RegisteredJobHandler[] {
  const logger =
    "db" in options
      ? options.logger ?? console
      : {
          info: options.info,
          warn() {}
        };

  const handlers: RegisteredJobHandler[] = [
    {
      name: "audit-event.created",
      async handle(input) {
        logger.info("audit_event_created_job_processed", {
          eventId: input.payload.eventId,
          organizationId: input.payload.organizationId,
          projectId: input.payload.projectId
        });
      }
    }
  ];

  if ("db" in options) {
    handlers.push(
      createProjectWebhookDeliveryHandler({
        db: options.db,
        logger,
        retryDelayMs: options.retryDelayMs
      })
    );
  }

  return handlers;
}
