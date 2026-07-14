import { getPresignedReadUrl } from "../s3/client.js";
import {
  createMetaProduct,
  updateMetaProduct,
  deleteMetaProduct,
} from "./meta-catalog.client.js";
import {
  getCatalogConfig,
  upsertCatalogConfig,
} from "../dynamodb/catalog-config.repository.js";
import {
  listProductsForBot,
  upsertProduct,
} from "../dynamodb/product.repository.js";
import type { CatalogProduct } from "../../types/index.js";

async function resolveProductImageUrl(product: CatalogProduct): Promise<string | undefined> {
  if (product.imageUrl) return product.imageUrl;
  if (!product.imageS3Key) return undefined;
  return getPresignedReadUrl(product.imageS3Key, 604800);
}

export async function syncProductToMeta(params: {
  tenantId: string;
  botId: string;
  product: CatalogProduct;
  accessToken: string;
}): Promise<CatalogProduct> {
  const config = await getCatalogConfig(params.tenantId, params.botId);
  if (!config?.metaCatalogId) {
    throw new Error("Meta catalog is not linked");
  }

  const imageUrl = await resolveProductImageUrl(params.product);

  try {
    const metaProductId = await createMetaProduct({
      catalogId: config.metaCatalogId,
      accessToken: params.accessToken,
      product: params.product,
      ...(imageUrl ? { imageUrl } : {}),
    });

    return upsertProduct({
      ...params.product,
      ...(metaProductId ? { metaProductId } : {}),
      syncStatus: "synced",
      ...(imageUrl ? { imageUrl } : {}),
    });
  } catch (err) {
    await upsertProduct({
      ...params.product,
      syncStatus: "error",
    });
    throw err;
  }
}

export async function pushProductUpdateToMeta(params: {
  tenantId: string;
  botId: string;
  product: CatalogProduct;
  accessToken: string;
}): Promise<CatalogProduct> {
  const config = await getCatalogConfig(params.tenantId, params.botId);
  if (!config?.metaCatalogId) {
    return upsertProduct({ ...params.product, syncStatus: "pending" });
  }

  const imageUrl = await resolveProductImageUrl(params.product);

  try {
    await updateMetaProduct({
      catalogId: config.metaCatalogId,
      retailerId: params.product.retailerId,
      accessToken: params.accessToken,
      product: params.product,
      ...(imageUrl ? { imageUrl } : {}),
    });

    return upsertProduct({
      ...params.product,
      syncStatus: "synced",
      ...(imageUrl ? { imageUrl } : {}),
    });
  } catch {
    return upsertProduct({
      ...params.product,
      syncStatus: "error",
    });
  }
}

export async function removeProductFromMeta(params: {
  tenantId: string;
  botId: string;
  retailerId: string;
  accessToken: string;
}): Promise<void> {
  const config = await getCatalogConfig(params.tenantId, params.botId);
  if (!config?.metaCatalogId) return;

  await deleteMetaProduct({
    catalogId: config.metaCatalogId,
    retailerId: params.retailerId,
    accessToken: params.accessToken,
  });
}

export async function syncAllProductsToMeta(params: {
  tenantId: string;
  botId: string;
  accessToken: string;
}): Promise<{ synced: number; failed: number }> {
  const config = await getCatalogConfig(params.tenantId, params.botId);
  if (!config?.metaCatalogId) {
    throw new Error("Meta catalog is not linked");
  }

  await upsertCatalogConfig({
    ...config,
    syncStatus: "syncing",
  });

  const products = await listProductsForBot(params.tenantId, params.botId);
  let synced = 0;
  let failed = 0;

  for (const product of products) {
    try {
      await pushProductUpdateToMeta({
        tenantId: params.tenantId,
        botId: params.botId,
        product,
        accessToken: params.accessToken,
      });
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  const now = new Date().toISOString();
  await upsertCatalogConfig({
    ...config,
    syncStatus: failed > 0 ? "error" : "linked",
    lastSyncAt: now,
    ...(failed > 0 ? { lastSyncError: `${failed} product(s) failed to sync` } : {}),
  });

  return { synced, failed };
}
