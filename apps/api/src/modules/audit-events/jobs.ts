import {
  type ProjectWebhookDeliveryJobPayload,
  type ProjectWebhookPayload,
  webhookDeliveryJobName
} from "@auditrail/domain";
import { auditTrailProduct } from "@auditrail/domain/audit-events";

import type { AuditEventRecord, AuditEventTenant } from "./repo.js";

export interface AuditEventCreatedJobPayload {
  createdAt: string;
  eventId: string;
  organizationId: string;
  projectId: string;
}

export interface AuditEventCreatedJob {
  name: "audit-event.created";
  payload: AuditEventCreatedJobPayload;
}

export interface ProjectWebhookDeliveryJob {
  name: typeof webhookDeliveryJobName;
  payload: ProjectWebhookDeliveryJobPayload;
}

export function createAuditEventCreatedJob(input: {
  event: AuditEventRecord;
  tenant: AuditEventTenant;
}): AuditEventCreatedJob {
  return {
    name: "audit-event.created",
    payload: {
      createdAt: input.event.createdAt,
      eventId: input.event.id,
      organizationId: input.tenant.organizationId,
      projectId: input.tenant.projectId
    }
  };
}

export function createProjectWebhookPayload(input: {
  event: AuditEventRecord;
  tenant: AuditEventTenant;
}): ProjectWebhookPayload {
  return {
    createdAt: input.event.createdAt,
    data: {
      auditEvent: {
        actorId: input.event.actorId,
        createdAt: input.event.createdAt,
        eventType: input.event.eventType,
        id: input.event.id,
        metadata: input.event.metadata,
        targetId: input.event.targetId
      }
    },
    id: input.event.id,
    organizationId: input.tenant.organizationId,
    productId: auditTrailProduct.id,
    projectId: input.tenant.projectId,
    type: "audit.event.created"
  };
}

export function createProjectWebhookDeliveryJob(input: {
  deliveryId: string;
}): ProjectWebhookDeliveryJob {
  return {
    name: webhookDeliveryJobName,
    payload: {
      deliveryId: input.deliveryId
    }
  };
}
