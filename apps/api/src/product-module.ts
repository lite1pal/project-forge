import type { FastifyInstance } from "fastify";

import {
  createProductManifestRegistry,
  type RegisteredProductModule
} from "@auditrail/domain/product";
import { auditTrailProductModule } from "@auditrail/domain/audit-events";
import { projectsProductModule } from "@auditrail/domain/projects";
import { todoProductModule } from "@auditrail/domain/todo";

import {
  registerEventRoutes,
} from "./modules/audit-events/routes.js";
import {
  registerProjectsProductRoutes,
  type ProjectsProductRoutesOptions
} from "./modules/projects/routes.js";

export interface ProductApiRouteRegistrationOptions
  extends Pick<ProjectsProductRoutesOptions, "platformService"> {
  prefix: string;
  productAccess?: {
    assertProductInstalledForOrganization(input: {
      organizationId: string;
      productId: string;
    }): Promise<void>;
  };
  productId?: string;
  projectAccess?: {
    resolveTenantForUser(input: {
      organizationId: string;
      projectId: string;
      userId: string;
    }): Promise<{
      organizationId: string;
      projectId: string;
    }>;
  };
}

type ApiProductModule = Pick<
  RegisteredProductModule,
  "getRuntimeRegistrations" | "manifest"
>;

type ProductApiRouteHandler = (
  app: FastifyInstance,
  options: Omit<ProductApiRouteRegistrationOptions, "prefix"> & {
    productId: string;
  }
) => Promise<void> | void;

const productApiRouteHandlers: Record<string, ProductApiRouteHandler> = {
  "audit-events-routes": async (app, options) => {
    await app.register(registerEventRoutes, options);
  },
  "projects-routes": async (app, options) => {
    await app.register(registerProjectsProductRoutes, options);
  }
};

const registeredProductModules = [
  auditTrailProductModule,
  projectsProductModule,
  todoProductModule
] as const satisfies readonly ApiProductModule[];

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
            ? "Versioned Elioric product API. The canonical contract is /api/v1."
            : "Versioned audit event ingestion and query API. The canonical contract is /api/v1.",
        title:
          registeredManifests.length > 1
            ? "Elioric Product API"
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
            productId: productModule.manifest.id,
            ...routeOptions
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
