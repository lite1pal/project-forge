import { createHmac } from "node:crypto";

import {
  projectWebhookDeliveries,
  projectWebhookEndpoints
} from "@auditrail/db/schema";
import {
  webhookDeliveryJobName,
  webhookEventHeader,
  webhookSignatureHeader,
  webhookSignatureTimestampHeader,
  type ProjectWebhookPayload
} from "@auditrail/domain";
import { eq } from "@auditrail/db";

import type { Database } from "@auditrail/db";
import type { RegisteredJobHandler } from "./handlers.js";
import { WorkerRetryableError } from "./job-errors.js";
import type { WorkerLogger } from "./worker.js";

const webhookDeliveryTimeoutMs = 5000;
const maxResponseSummaryLength = 500;

export function createProjectWebhookDeliveryHandler(options: {
  db: Database;
  fetch?: typeof fetch;
  logger?: Pick<WorkerLogger, "info" | "warn">;
  now?: () => Date;
  retryDelayMs: number;
}): RegisteredJobHandler {
  const fetcher = options.fetch ?? fetch;
  const logger = options.logger ?? console;
  const now = options.now ?? (() => new Date());

  return {
    name: webhookDeliveryJobName,
    async handle(input) {
      const deliveryId = String(input.payload.deliveryId ?? "");

      if (!deliveryId) {
        throw new Error("invalid_webhook_delivery_job");
      }

      const delivery = await startDeliveryAttempt(options.db, {
        deliveryId,
        startedAt: now()
      });

      if (!delivery || !delivery.endpointEnabled) {
        await markWebhookDeliveryFailed(options.db, {
          deliveryId,
          failedAt: now(),
          lastError: "webhook_endpoint_unavailable",
          retryable: false
        });
        logger.warn("webhook_delivery_endpoint_unavailable", {
          deliveryId
        });
        return;
      }

      const payloadText = JSON.stringify(delivery.payload);
      const timestamp = now().toISOString();
      const signature = createWebhookSignature({
        payload: payloadText,
        secret: delivery.endpointSecret,
        timestamp
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhookDeliveryTimeoutMs);

      try {
        const response = await fetcher(delivery.endpointUrl, {
          body: payloadText,
          headers: {
            "content-type": "application/json",
            [webhookEventHeader]: delivery.payload.type,
            [webhookSignatureHeader]: signature,
            [webhookSignatureTimestampHeader]: timestamp
          },
          method: "POST",
          signal: controller.signal
        });
        const responseBodySummary = truncateSummary(await response.text());

        if (response.status >= 200 && response.status < 300) {
          await markWebhookDeliverySucceeded(options.db, {
            deliveredAt: now(),
            deliveryId,
            responseBodySummary,
            responseStatusCode: response.status
          });
          logger.info("webhook_delivery_succeeded", {
            deliveryId,
            endpointId: delivery.endpointId,
            responseStatusCode: response.status
          });
          return;
        }

        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;

        await markWebhookDeliveryFailed(options.db, {
          deliveryId,
          failedAt: now(),
          lastError: `webhook_delivery_failed:${response.status}`,
          nextRetryAt: retryable
            ? new Date(now().getTime() + options.retryDelayMs)
            : undefined,
          responseBodySummary,
          responseStatusCode: response.status,
          retryable
        });

        if (retryable) {
          throw new WorkerRetryableError(`webhook_delivery_failed:${response.status}`);
        }

        return;
      } catch (error) {
        if (error instanceof WorkerRetryableError) {
          throw error;
        }

        const message =
          error instanceof Error && error.name === "AbortError"
            ? "webhook_delivery_timeout"
            : error instanceof Error
              ? error.message
              : String(error);

        await markWebhookDeliveryFailed(options.db, {
          deliveryId,
          failedAt: now(),
          lastError: message,
          nextRetryAt: new Date(now().getTime() + options.retryDelayMs),
          retryable: true
        });

        throw new WorkerRetryableError(message);
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

export function createWebhookSignature(input: {
  payload: string;
  secret: string;
  timestamp: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.payload}`)
    .digest("hex");
}

async function startDeliveryAttempt(
  db: Database,
  input: {
    deliveryId: string;
    startedAt: Date;
  }
) {
  const [existingRecord] = await db
    .select({
      attemptCount: projectWebhookDeliveries.attemptCount
    })
    .from(projectWebhookDeliveries)
    .where(eq(projectWebhookDeliveries.id, input.deliveryId))
    .limit(1);

  if (!existingRecord) {
    return undefined;
  }

  await db
    .update(projectWebhookDeliveries)
    .set({
      attemptCount: existingRecord.attemptCount + 1,
      status: "delivering",
      updatedAt: input.startedAt
    })
    .where(eq(projectWebhookDeliveries.id, input.deliveryId));
  const [record] = await db
    .select({
      endpointEnabled: projectWebhookEndpoints.enabled,
      endpointId: projectWebhookEndpoints.id,
      endpointSecret: projectWebhookEndpoints.secret,
      endpointUrl: projectWebhookEndpoints.url,
      payload: projectWebhookDeliveries.payload
    })
    .from(projectWebhookDeliveries)
    .innerJoin(
      projectWebhookEndpoints,
      eq(projectWebhookEndpoints.id, projectWebhookDeliveries.endpointId)
    )
    .where(eq(projectWebhookDeliveries.id, input.deliveryId))
    .limit(1);

  if (!record) {
    return undefined;
  }

  return {
    endpointEnabled: record.endpointEnabled,
    endpointId: record.endpointId,
    endpointSecret: record.endpointSecret,
    endpointUrl: record.endpointUrl,
    payload: record.payload as ProjectWebhookPayload
  };
}

async function markWebhookDeliverySucceeded(
  db: Database,
  input: {
    deliveredAt: Date;
    deliveryId: string;
    responseBodySummary?: string;
    responseStatusCode: number;
  }
) {
  await db
    .update(projectWebhookDeliveries)
    .set({
      deliveredAt: input.deliveredAt,
      lastError: null,
      nextRetryAt: null,
      responseBodySummary: input.responseBodySummary,
      responseStatusCode: input.responseStatusCode,
      status: "succeeded",
      updatedAt: input.deliveredAt
    })
    .where(eq(projectWebhookDeliveries.id, input.deliveryId));
}

async function markWebhookDeliveryFailed(
  db: Database,
  input: {
    deliveryId: string;
    failedAt: Date;
    lastError: string;
    nextRetryAt?: Date;
    responseBodySummary?: string;
    responseStatusCode?: number;
    retryable: boolean;
  }
) {
  await db
    .update(projectWebhookDeliveries)
    .set({
      lastError: input.lastError,
      nextRetryAt: input.nextRetryAt ?? null,
      responseBodySummary: input.responseBodySummary,
      responseStatusCode: input.responseStatusCode,
      status: input.retryable ? "pending" : "failed",
      updatedAt: input.failedAt
    })
    .where(eq(projectWebhookDeliveries.id, input.deliveryId));
}

function truncateSummary(value: string) {
  if (value.length <= maxResponseSummaryLength) {
    return value;
  }

  return value.slice(0, maxResponseSummaryLength);
}
