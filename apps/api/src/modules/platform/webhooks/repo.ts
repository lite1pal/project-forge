import type {
  ProjectWebhookDelivery,
  ProjectWebhookEndpoint
} from "@auditrail/domain";

import type { Membership } from "../service.js";

export interface ProjectWebhookEndpointRecord extends ProjectWebhookEndpoint {
  secret: string;
  secretRotatedAt: string;
}

export interface ProjectWebhookEndpointSummary extends ProjectWebhookEndpoint {
  latestDelivery?: ProjectWebhookDelivery;
}

export interface PlatformProjectWebhooksRepo {
  createProjectWebhookEndpoint(input: {
    enabled?: boolean;
    organizationId: string;
    projectId: string;
    secret: string;
    subscribedEventTypes: ProjectWebhookEndpoint["subscribedEventTypes"];
    url: string;
  }): Promise<ProjectWebhookEndpointRecord>;
  deleteProjectWebhookEndpoint(input: {
    endpointId: string;
    organizationId: string;
    projectId: string;
  }): Promise<boolean>;
  findMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<Membership | undefined>;
  findProject(input: {
    organizationId: string;
    projectId: string;
  }): Promise<{ id: string } | undefined>;
  findProjectWebhookEndpoint(input: {
    endpointId: string;
    organizationId: string;
    projectId: string;
  }): Promise<ProjectWebhookEndpointRecord | undefined>;
  listLatestDeliveriesByEndpointIds(
    endpointIds: string[]
  ): Promise<Map<string, ProjectWebhookDelivery>>;
  listProjectWebhookEndpoints(input: {
    organizationId: string;
    projectId: string;
  }): Promise<ProjectWebhookEndpointRecord[]>;
  rotateProjectWebhookSecret(input: {
    endpointId: string;
    organizationId: string;
    projectId: string;
    secret: string;
  }): Promise<ProjectWebhookEndpointRecord | undefined>;
  updateProjectWebhookEndpoint(input: {
    enabled?: boolean;
    endpointId: string;
    organizationId: string;
    projectId: string;
    subscribedEventTypes?: ProjectWebhookEndpoint["subscribedEventTypes"];
    url?: string;
  }): Promise<ProjectWebhookEndpointRecord | undefined>;
}
