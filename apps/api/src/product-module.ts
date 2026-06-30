import type { FastifyInstance } from "fastify";

import { auditTrailProductModule } from "@auditrail/domain/audit-events";

import {
  registerEventRoutes,
  type EventRoutesOptions
} from "./modules/audit-events/routes.js";

export interface ProductApiRouteRegistrationOptions extends EventRoutesOptions {
  prefix: string;
}

export function getProductApiOpenApiInfo() {
  return {
    description:
      "Versioned audit event ingestion and query API. The canonical contract is /api/v1.",
    title: `${auditTrailProductModule.manifest.name} API`
  };
}

export async function registerProductApiRoutes(
  app: FastifyInstance,
  options: ProductApiRouteRegistrationOptions
) {
  const { prefix: _prefix, ...routeOptions } = options;

  for (const registration of auditTrailProductModule.getRuntimeRegistrations("api")) {
    if (registration.target === "audit-events-routes") {
      app.register(registerEventRoutes, routeOptions);
      continue;
    }

    throw new Error(
      `unsupported_product_api_registration_target:${registration.target}`
    );
  }
}
