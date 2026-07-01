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

export interface ApiProductModule<
  TManifest extends { id: string; name: string } = { id: string; name: string }
> {
  getRuntimeRegistrations(surface: "api" | "web" | "worker"): ReadonlyArray<{
    id: string;
    surface: "api" | "web" | "worker";
    target: string;
  }>;
  manifest: TManifest;
}

type ProductApiRouteHandler = (
  app: FastifyInstance,
  options: Omit<ProductApiRouteRegistrationOptions, "prefix"> & {
    productId: string;
  }
) => Promise<void> | void;

const productApiRouteHandlers: Record<string, ProductApiRouteHandler> = {
  "audit-events-routes": async (app, options) => {
    await app.register(registerEventRoutes, options);
  }
};

const registeredProductModules = [auditTrailProductModule] as const;

export function createApiProductRuntime(
  productModules: readonly ApiProductModule[] = registeredProductModules,
  routeHandlers: Readonly<Record<string, ProductApiRouteHandler>> = productApiRouteHandlers
) {
  const productRegistry = createProductManifestRegistry(
    productModules.map((productModule) => productModule.manifest)
  );
  const productModulesById = new Map(
    productModules.map((productModule) => [productModule.manifest.id, productModule] as const)
  );
  const defaultProductManifest = productRegistry.list()[0];

  if (!defaultProductManifest) {
    throw new Error("missing_registered_product_modules");
  }

  return {
    currentProductId: defaultProductManifest.id,
    getProductApiOpenApiInfo() {
      const registeredManifests = productRegistry.list();

      return {
        description:
          registeredManifests.length > 1
            ? "Versioned Project Anvil product API. The canonical contract is /api/v1."
            : "Versioned audit event ingestion and query API. The canonical contract is /api/v1.",
        title:
          registeredManifests.length > 1
            ? "Project Anvil Product API"
            : `${defaultProductManifest.name} API`
      };
    },
    listRegisteredProducts() {
      return productRegistry.list().map((manifest) => ({
        id: manifest.id,
        name: manifest.name
      }));
    },
    async registerProductApiRoutes(
      app: FastifyInstance,
      options: ProductApiRouteRegistrationOptions
    ) {
      const { prefix: _prefix, ...routeOptions } = options;

      for (const productModule of productModules) {
        for (const registration of productModule.getRuntimeRegistrations("api")) {
          const handler = routeHandlers[registration.target];

          if (!handler) {
            throw new Error(
              `unsupported_product_api_registration_target:${registration.target}`
            );
          }

          await handler(app, {
            ...routeOptions,
            productId: productModule.manifest.id
          });
        }
      }
    },
    requireProductModule(productId: string) {
      const productModule = productModulesById.get(productId);

      if (!productModule) {
        throw new Error(`unknown_product_module:${productId}`);
      }

      return productModule;
    }
  };
}

const apiProductRuntime = createApiProductRuntime();

export const currentProductId = apiProductRuntime.currentProductId;

export function getProductApiOpenApiInfo() {
  return apiProductRuntime.getProductApiOpenApiInfo();
}

export function listRegisteredProducts() {
  return apiProductRuntime.listRegisteredProducts();
}

export async function registerProductApiRoutes(
  app: FastifyInstance,
  options: ProductApiRouteRegistrationOptions
) {
  await apiProductRuntime.registerProductApiRoutes(app, options);
}
