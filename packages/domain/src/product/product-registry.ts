import { z } from "zod";

import type { ProductModuleManifest } from "./product-module.js";

const nonEmptyStringSchema = z.string().trim().min(1);

export interface InstalledProductState {
  enabled: boolean;
  productId: string;
}

export const installedProductStateSchema = z.object({
  enabled: z.boolean(),
  productId: nonEmptyStringSchema
}) satisfies z.ZodType<InstalledProductState>;

export interface ProductManifestRegistry<
  TManifest extends ProductModuleManifest = ProductModuleManifest
> {
  get(productId: string): TManifest | undefined;
  hasEnabledProduct(
    installedProducts: readonly InstalledProductState[],
    productId: string
  ): boolean;
  list(): readonly TManifest[];
  require(productId: string): TManifest;
  resolveEnabledProducts(
    installedProducts: readonly InstalledProductState[]
  ): readonly TManifest[];
}

export function createProductManifestRegistry<
  TManifest extends ProductModuleManifest
>(manifests: readonly TManifest[]): ProductManifestRegistry<TManifest> {
  const manifestsById = new Map(
    manifests.map((manifest) => [manifest.id, manifest] as const)
  );

  return {
    get(productId) {
      return manifestsById.get(productId);
    },
    hasEnabledProduct(installedProducts, productId) {
      return installedProducts.some(
        (installedProduct) =>
          installedProduct.productId === productId &&
          installedProduct.enabled &&
          manifestsById.has(productId)
      );
    },
    list() {
      return manifests;
    },
    require(productId) {
      const manifest = manifestsById.get(productId);

      if (!manifest) {
        throw new Error(`unknown_product_manifest:${productId}`);
      }

      return manifest;
    },
    resolveEnabledProducts(installedProducts) {
      return installedProducts
        .filter((installedProduct) => installedProduct.enabled)
        .map((installedProduct) => manifestsById.get(installedProduct.productId))
        .filter((manifest): manifest is TManifest => Boolean(manifest));
    }
  };
}
