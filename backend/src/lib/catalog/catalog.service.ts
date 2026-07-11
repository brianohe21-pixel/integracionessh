import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildOrderStatusChangedPayload } from "../integrations/payloads.js";
import { getPresignedReadUrl, buildCatalogImageS3Key } from "../s3/client.js";
import {
  countEnabledCatalogs,
  getCatalogConfig,
  listCatalogConfigs,
  listEnabledCatalogConfigs,
  upsertCatalogConfig,
} from "../dynamodb/catalog-config.repository.js";
import {
  countProductsForBot,
  deleteProduct,
  getProduct,
  getProductByRetailerId,
  listProductsForBot,
  makeProductId,
  upsertProduct,
} from "../dynamodb/product.repository.js";
import {
  countOrdersForTenantInMonth,
  createOrderRecord,
  getOrder,
  listOrdersForBot,
  makeOrderId,
  updateOrder,
} from "../dynamodb/order.repository.js";
import { listMetaCatalogs } from "./meta-catalog.client.js";
import {
  pushProductUpdateToMeta,
  removeProductFromMeta,
  syncAllProductsToMeta,
  syncProductToMeta,
} from "./sync.js";
import { sendOrderStatusNotification } from "./notify.js";
import type {
  CatalogConfig,
  CatalogOrder,
  CatalogProduct,
  OrderItem,
  OrderSource,
  OrderStatus,
  ProductAvailability,
  WhatsAppOrderPayload,
} from "../../types/index.js";

export function defaultCatalogConfig(tenantId: string, botId: string): CatalogConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    botId,
    enabled: false,
    currency: "COP",
    autoCollectPayment: false,
    orderConfirmationMessage:
      "¡Gracias por tu pedido! #{{order_id}}\n{{items}}\nTotal: {{total}}",
    orderStatusMessageTemplate:
      "Tu pedido #{{order_id}} está {{status}}. Total: {{total}}.",
    catalogMessageText: "Explora nuestro catálogo y arma tu pedido.",
    syncStatus: "not_linked",
    createdAt: now,
    updatedAt: now,
  };
}

export async function getConfigOrDefault(
  tenantId: string,
  botId: string
): Promise<CatalogConfig> {
  const existing = await getCatalogConfig(tenantId, botId);
  return existing ?? defaultCatalogConfig(tenantId, botId);
}

export async function getCatalogConfigForBot(
  tenantId: string,
  botId: string
): Promise<CatalogConfig | null> {
  return getCatalogConfig(tenantId, botId);
}

export async function enableCatalog(tenantId: string, botId: string): Promise<CatalogConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertCatalogConfig({ ...existing, enabled: true });
}

export async function disableCatalog(tenantId: string, botId: string): Promise<CatalogConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertCatalogConfig({ ...existing, enabled: false });
}

export async function saveCatalogConfig(
  tenantId: string,
  botId: string,
  patch: Partial<
    Pick<
      CatalogConfig,
      | "autoCollectPayment"
      | "orderConfirmationMessage"
      | "orderStatusMessageTemplate"
      | "catalogMessageText"
      | "currency"
    >
  >
): Promise<CatalogConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertCatalogConfig({ ...existing, ...patch });
}

export async function linkMetaCatalog(
  tenantId: string,
  botId: string,
  metaCatalogId: string
): Promise<CatalogConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertCatalogConfig({
    ...existing,
    metaCatalogId,
    syncStatus: "linked",
  });
}

export async function listMetaCatalogsForBot(
  wabaId: string,
  accessToken: string
) {
  return listMetaCatalogs(wabaId, accessToken);
}

export async function requireEnabledCatalog(
  tenantId: string,
  botId: string
): Promise<CatalogConfig> {
  const config = await getConfigOrDefault(tenantId, botId);
  if (!config.enabled) {
    throw new Error("Catalog app is not enabled for this bot");
  }
  return config;
}

export async function listEnabledCatalogsForTenant(tenantId: string): Promise<CatalogConfig[]> {
  return listEnabledCatalogConfigs(tenantId);
}

export async function countEnabledCatalogsForTenant(tenantId: string): Promise<number> {
  return countEnabledCatalogs(tenantId);
}

export async function listProducts(tenantId: string, botId: string): Promise<CatalogProduct[]> {
  await getConfigOrDefault(tenantId, botId);
  return listProductsForBot(tenantId, botId);
}

export async function createProduct(params: {
  tenantId: string;
  botId: string;
  retailerId: string;
  name: string;
  description: string;
  priceInCents: number;
  availability: ProductAvailability;
  accessToken?: string;
}): Promise<CatalogProduct> {
  const config = await getConfigOrDefault(params.tenantId, params.botId);
  const existing = await getProductByRetailerId(
    params.tenantId,
    params.botId,
    params.retailerId
  );
  if (existing) {
    throw new Error("A product with this retailer ID already exists");
  }

  const now = new Date().toISOString();
  const products = await listProductsForBot(params.tenantId, params.botId);
  const product: CatalogProduct = {
    productId: makeProductId(),
    tenantId: params.tenantId,
    botId: params.botId,
    retailerId: params.retailerId,
    name: params.name,
    description: params.description,
    priceInCents: params.priceInCents,
    currency: config.currency,
    availability: params.availability,
    syncStatus: "pending",
    sortOrder: products.length,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await upsertProduct(product);

  if (params.accessToken && config.metaCatalogId) {
    return syncProductToMeta({
      tenantId: params.tenantId,
      botId: params.botId,
      product: saved,
      accessToken: params.accessToken,
    });
  }

  return saved;
}

export async function updateProduct(params: {
  tenantId: string;
  botId: string;
  productId: string;
  patch: Partial<
    Pick<
      CatalogProduct,
      "name" | "description" | "priceInCents" | "availability" | "sortOrder" | "imageS3Key" | "imageUrl"
    >
  >;
  accessToken?: string;
}): Promise<CatalogProduct> {
  const existing = await getProduct(params.tenantId, params.productId);
  if (!existing || existing.botId !== params.botId) {
    throw new Error("Product not found");
  }

  const updated: CatalogProduct = {
    ...existing,
    ...params.patch,
    syncStatus: "pending",
  };

  const saved = await upsertProduct(updated);

  if (params.accessToken) {
    return pushProductUpdateToMeta({
      tenantId: params.tenantId,
      botId: params.botId,
      product: saved,
      accessToken: params.accessToken,
    });
  }

  return saved;
}

export async function removeProduct(params: {
  tenantId: string;
  botId: string;
  productId: string;
  accessToken?: string;
}): Promise<void> {
  const existing = await getProduct(params.tenantId, params.productId);
  if (!existing || existing.botId !== params.botId) {
    throw new Error("Product not found");
  }

  if (params.accessToken) {
    await removeProductFromMeta({
      tenantId: params.tenantId,
      botId: params.botId,
      retailerId: existing.retailerId,
      accessToken: params.accessToken,
    }).catch((err) => console.error("Failed to delete product from Meta:", err));
  }

  await deleteProduct(params.tenantId, params.productId);
}

export async function prepareProductImageUpload(params: {
  tenantId: string;
  botId: string;
  productId: string;
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; s3Key: string }> {
  const product = await getProduct(params.tenantId, params.productId);
  if (!product || product.botId !== params.botId) {
    throw new Error("Product not found");
  }

  const { getPresignedUploadUrl } = await import("../s3/client.js");
  const s3Key = buildCatalogImageS3Key(
    params.tenantId,
    params.botId,
    params.productId,
    params.filename
  );
  const uploadUrl = await getPresignedUploadUrl(s3Key, params.contentType);
  return { uploadUrl, s3Key };
}

export async function finalizeProductImage(params: {
  tenantId: string;
  botId: string;
  productId: string;
  s3Key: string;
  accessToken?: string;
}): Promise<CatalogProduct> {
  const imageUrl = await getPresignedReadUrl(params.s3Key, 604800);
  return updateProduct({
    tenantId: params.tenantId,
    botId: params.botId,
    productId: params.productId,
    patch: { imageS3Key: params.s3Key, imageUrl },
    ...(params.accessToken ? { accessToken: params.accessToken } : {}),
  });
}

export async function syncCatalogProducts(params: {
  tenantId: string;
  botId: string;
  accessToken: string;
}) {
  return syncAllProductsToMeta(params);
}

function parseOrderItems(
  tenantId: string,
  botId: string,
  orderPayload: WhatsAppOrderPayload
): Promise<{ items: OrderItem[]; unresolvedItems: boolean }> {
  return Promise.all(
    orderPayload.product_items.map(async (item) => {
      const quantity = Number(item.quantity);
      const local = await getProductByRetailerId(
        tenantId,
        botId,
        item.product_retailer_id
      );
      const rawPrice = Number(item.item_price);
      const unitPriceInCents = local
        ? local.priceInCents
        : rawPrice >= 1000
          ? Math.round(rawPrice)
          : Math.round(rawPrice * 100);
      return {
        retailerId: item.product_retailer_id,
        ...(local?.productId ? { productId: local.productId } : {}),
        name: local?.name ?? item.product_retailer_id,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unitPriceInCents: Number.isFinite(unitPriceInCents) ? unitPriceInCents : 0,
        currency: "COP" as const,
        unresolved: !local,
      };
    })
  ).then((rows) => ({
    items: rows.map(({ unresolved: _u, ...item }) => item),
    unresolvedItems: rows.some((r) => r.unresolved),
  }));
}

export async function createOrderFromWebhook(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  contactPhone: string;
  contactName?: string;
  orderPayload: WhatsAppOrderPayload;
  whatsappMessageId: string;
  source: OrderSource;
}): Promise<CatalogOrder> {
  const config = await getConfigOrDefault(params.tenantId, params.botId);
  const { items, unresolvedItems } = await parseOrderItems(
    params.tenantId,
    params.botId,
    params.orderPayload
  );

  const subtotalInCents = items.reduce(
    (sum, item) => sum + item.unitPriceInCents * item.quantity,
    0
  );

  const now = new Date().toISOString();
  const order: CatalogOrder = {
    orderId: makeOrderId(),
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
    contactPhone: params.contactPhone,
    ...(params.contactName ? { contactName: params.contactName } : {}),
    status: "pending",
    catalogId: params.orderPayload.catalog_id,
    ...(params.orderPayload.text ? { customerNote: params.orderPayload.text } : {}),
    items,
    subtotalInCents,
    currency: config.currency,
    source: params.source,
    whatsappMessageId: params.whatsappMessageId,
    ...(unresolvedItems ? { unresolvedItems: true } : {}),
    createdAt: now,
    updatedAt: now,
  };

  return createOrderRecord(order);
}

export async function listOrders(params: {
  tenantId: string;
  botId: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<CatalogOrder[]> {
  await getConfigOrDefault(params.tenantId, params.botId);
  return listOrdersForBot(params);
}

export async function getOrderById(
  tenantId: string,
  botId: string,
  orderId: string
): Promise<CatalogOrder | null> {
  const order = await getOrder(tenantId, orderId);
  if (!order || order.botId !== botId) return null;
  return order;
}

export async function updateOrderStatus(params: {
  tenantId: string;
  botId: string;
  orderId: string;
  status: OrderStatus;
  internalNotes?: string;
  environment: string;
}): Promise<CatalogOrder> {
  const existing = await getOrderById(params.tenantId, params.botId, params.orderId);
  if (!existing) throw new Error("Order not found");

  const config = await getConfigOrDefault(params.tenantId, params.botId);
  const updated = await updateOrder(params.tenantId, params.orderId, {
    status: params.status,
    ...(params.internalNotes !== undefined ? { internalNotes: params.internalNotes } : {}),
  });
  if (!updated) throw new Error("Order not found");

  await sendOrderStatusNotification({
    tenantId: params.tenantId,
    botId: params.botId,
    order: updated,
    status: params.status,
    ...(config.orderStatusMessageTemplate
      ? { messageTemplate: config.orderStatusMessageTemplate }
      : {}),
    environment: params.environment,
  }).catch((err) => console.error("Failed to send order status notification:", err));

  await emitIntegrationEvent(
    params.tenantId,
    "order.status_changed",
    buildOrderStatusChangedPayload({
      tenantId: params.tenantId,
      botId: params.botId,
      order: updated,
      previousStatus: existing.status,
    })
  ).catch((err) => console.error("Failed to emit order.status_changed:", err));

  return updated;
}

export async function countProducts(tenantId: string, botId: string): Promise<number> {
  return countProductsForBot(tenantId, botId);
}

export async function countOrdersThisMonth(tenantId: string): Promise<number> {
  const yearMonth = new Date().toISOString().slice(0, 7);
  return countOrdersForTenantInMonth(tenantId, yearMonth);
}

export { listCatalogConfigs };
