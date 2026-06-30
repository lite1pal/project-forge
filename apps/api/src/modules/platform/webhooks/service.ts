import { randomBytes } from "node:crypto";

import {
  createProjectWebhookEndpointSchema,
  projectWebhookEndpointSecretSchema,
  updateProjectWebhookEndpointSchema,
  type ProjectWebhookEndpoint
} from "@auditrail/domain";

import { assertRole } from "../service.js";
import type {
  PlatformProjectWebhooksRepo,
  ProjectWebhookEndpointSummary
} from "./repo.js";

export interface PlatformProjectWebhooksService {
  createEndpointForUser(input: {
    organizationId: string;
    projectId: string;
    subscribedEventTypes: ProjectWebhookEndpoint["subscribedEventTypes"];
    url: string;
    userId: string;
  }): Promise<{
    endpoint: ProjectWebhookEndpointSummary;
    secret: string;
  }>;
  deleteEndpointForUser(input: {
    endpointId: string;
    organizationId: string;
    projectId: string;
    userId: string;
  }): Promise<void>;
  listEndpointsForUser(input: {
    organizationId: string;
    projectId: string;
    userId: string;
  }): Promise<ProjectWebhookEndpointSummary[]>;
  rotateSecretForUser(input: {
    endpointId: string;
    organizationId: string;
    projectId: string;
    userId: string;
  }): Promise<{
    endpoint: ProjectWebhookEndpointSummary;
    secret: string;
  }>;
  updateEndpointForUser(input: {
    enabled?: boolean;
    endpointId: string;
    organizationId: string;
    projectId: string;
    subscribedEventTypes?: ProjectWebhookEndpoint["subscribedEventTypes"];
    url?: string;
    userId: string;
  }): Promise<ProjectWebhookEndpointSummary>;
}

export function createPlatformProjectWebhooksService(
  repo: PlatformProjectWebhooksRepo,
  options: {
    secretFactory?: () => string;
  } = {}
): PlatformProjectWebhooksService {
  const secretFactory =
    options.secretFactory ?? (() => `whsec_${randomBytes(24).toString("hex")}`);

  return {
    async createEndpointForUser(input) {
      await assertProjectAdminAccess(repo, input);
      const parsed = createProjectWebhookEndpointSchema.parse({
        subscribedEventTypes: input.subscribedEventTypes,
        url: input.url
      });
      const secret = projectWebhookEndpointSecretSchema.parse({
        secret: secretFactory()
      }).secret;
      const endpoint = await repo.createProjectWebhookEndpoint({
        organizationId: input.organizationId,
        projectId: input.projectId,
        secret,
        subscribedEventTypes: parsed.subscribedEventTypes,
        url: parsed.url
      });

      return {
        endpoint: toSummary(endpoint),
        secret
      };
    },
    async deleteEndpointForUser(input) {
      await assertProjectAdminAccess(repo, input);
      const deleted = await repo.deleteProjectWebhookEndpoint({
        endpointId: input.endpointId,
        organizationId: input.organizationId,
        projectId: input.projectId
      });

      if (!deleted) {
        throw new Error("webhook_not_found");
      }
    },
    async listEndpointsForUser(input) {
      await assertProjectAdminAccess(repo, input);
      const endpoints = await repo.listProjectWebhookEndpoints({
        organizationId: input.organizationId,
        projectId: input.projectId
      });
      const latestDeliveries = await repo.listLatestDeliveriesByEndpointIds(
        endpoints.map((endpoint) => endpoint.id)
      );

      return endpoints.map((endpoint) => ({
        ...toSummary(endpoint),
        latestDelivery: latestDeliveries.get(endpoint.id)
      }));
    },
    async rotateSecretForUser(input) {
      await assertProjectAdminAccess(repo, input);
      const secret = projectWebhookEndpointSecretSchema.parse({
        secret: secretFactory()
      }).secret;
      const endpoint = await repo.rotateProjectWebhookSecret({
        endpointId: input.endpointId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        secret
      });

      if (!endpoint) {
        throw new Error("webhook_not_found");
      }

      return {
        endpoint: toSummary(endpoint),
        secret
      };
    },
    async updateEndpointForUser(input) {
      await assertProjectAdminAccess(repo, input);
      const parsed = updateProjectWebhookEndpointSchema.parse({
        enabled: input.enabled,
        subscribedEventTypes: input.subscribedEventTypes,
        url: input.url
      });

      if (Object.keys(parsed).length === 0) {
        throw new Error("invalid_webhook_request");
      }

      const endpoint = await repo.updateProjectWebhookEndpoint({
        enabled: parsed.enabled,
        endpointId: input.endpointId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        subscribedEventTypes: parsed.subscribedEventTypes,
        url: parsed.url
      });

      if (!endpoint) {
        throw new Error("webhook_not_found");
      }

      const latestDelivery = await repo.listLatestDeliveriesByEndpointIds([endpoint.id]);

      return {
        ...toSummary(endpoint),
        latestDelivery: latestDelivery.get(endpoint.id)
      };
    }
  };
}

async function assertProjectAdminAccess(
  repo: Pick<PlatformProjectWebhooksRepo, "findMembership" | "findProject">,
  input: {
    organizationId: string;
    projectId: string;
    userId: string;
  }
) {
  const membership = await repo.findMembership({
    organizationId: input.organizationId,
    userId: input.userId
  });

  assertRole(membership, ["owner", "admin"]);
  const project = await repo.findProject({
    organizationId: input.organizationId,
    projectId: input.projectId
  });

  if (!project) {
    throw new Error("project_not_found");
  }
}

function toSummary(endpoint: {
  createdAt: string;
  enabled: boolean;
  id: string;
  organizationId: string;
  projectId: string;
  subscribedEventTypes: ProjectWebhookEndpoint["subscribedEventTypes"];
  updatedAt: string;
  url: string;
}): ProjectWebhookEndpointSummary {
  return {
    createdAt: endpoint.createdAt,
    enabled: endpoint.enabled,
    id: endpoint.id,
    organizationId: endpoint.organizationId,
    projectId: endpoint.projectId,
    subscribedEventTypes: endpoint.subscribedEventTypes,
    updatedAt: endpoint.updatedAt,
    url: endpoint.url
  };
}
