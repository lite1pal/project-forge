import type { FastifyInstance } from "fastify";

import { auditTrailProductModule } from "@auditrail/domain/audit-events";
import { createProductManifestRegistry } from "@auditrail/domain/product";

import {
  registerEventRoutes,
  type EventRoutesOptions
} from "./modules/audit-events/routes.js";

export interface ProductApiRouteRegistrationOptions extends EventRoutesOptions {
  prefix: string;
}

const productRegistry = createProductManifestRegistry([
  auditTrailProductModule.manifest
]);
const currentProductManifest = productRegistry.require(
  auditTrailProductModule.manifest.id
);

export const currentProductId = currentProductManifest.id;

export function getProductApiOpenApiInfo() {
  return {
    description:
      "Versioned audit event ingestion and query API. The canonical contract is /api/v1.",
    title: `${currentProductManifest.name} API`
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
