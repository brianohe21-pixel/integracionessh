import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  ShopifyCheckout,
  ShopifyConfig,
  ShopifyDelivery,
  ShopifyNotificationEvent,
} from "../../types/index.js";

const configKeys = (tenantId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: "APP#shopify",
});

function stripItem<T>(item: Record<string, unknown>): T {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as T;
}

export async function getShopifyConfig(tenantId: string): Promise<ShopifyConfig | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
  if (!result.Item) return null;
  return stripItem<ShopifyConfig>(result.Item);
}

export async function findTenantIdByShopDomain(shopDomain: string): Promise<string | null> {
  const domain = shopDomain.trim().toLowerCase();
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `SHOPIFY#SHOP#${domain}`,
      },
      Limit: 1,
    })
  );
  const item = result.Items?.[0];
  if (!item?.tenantId || typeof item.tenantId !== "string") return null;
  return item.tenantId;
}

export async function upsertShopifyConfig(config: ShopifyConfig): Promise<ShopifyConfig> {
  const domain = config.shopDomain.trim().toLowerCase();
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...configKeys(config.tenantId),
        ...config,
        shopDomain: domain,
        GSI1PK: `SHOPIFY#SHOP#${domain}`,
        GSI1SK: `TENANT#${config.tenantId}`,
      },
    })
  );
  return { ...config, shopDomain: domain };
}

export async function deleteShopifyConfig(tenantId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
}

function checkoutKeys(tenantId: string, checkoutToken: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `SHOPIFY#CHECKOUT#${checkoutToken}`,
  };
}

export async function getShopifyCheckout(
  tenantId: string,
  checkoutToken: string
): Promise<ShopifyCheckout | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: checkoutKeys(tenantId, checkoutToken),
    })
  );
  if (!result.Item) return null;
  return stripItem<ShopifyCheckout>(result.Item);
}

export async function putShopifyCheckout(checkout: ShopifyCheckout): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...checkoutKeys(checkout.tenantId, checkout.checkoutToken),
        ...checkout,
      },
    })
  );
}

export async function deleteShopifyCheckoutsForTenant(tenantId: string): Promise<void> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "SHOPIFY#CHECKOUT#",
      },
    })
  );
  for (const item of result.Items ?? []) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
      })
    );
  }
}

export async function deleteShopifyCheckoutsByPhone(
  tenantId: string,
  phoneDigits: string
): Promise<void> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "SHOPIFY#CHECKOUT#",
      },
    })
  );
  for (const item of result.Items ?? []) {
    const phone = typeof item.phone === "string" ? item.phone.replace(/\D/g, "") : "";
    if (phone && phone === phoneDigits) {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
        })
      );
    }
  }
}

function eventKeys(tenantId: string, webhookId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `SHOPIFY#EVENT#${webhookId}`,
  };
}

export async function claimShopifyWebhookEvent(
  tenantId: string,
  webhookId: string,
  topic: string
): Promise<boolean> {
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...eventKeys(tenantId, webhookId),
          tenantId,
          webhookId,
          topic,
          createdAt: new Date().toISOString(),
          ttl: expiresAt,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return false;
    }
    throw error;
  }
}

function deliveryKeys(tenantId: string, deliveryId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `SHOPIFY#DELIVERY#${deliveryId}`,
  };
}

export async function putShopifyDelivery(
  input: Omit<ShopifyDelivery, "deliveryId" | "createdAt"> & {
    deliveryId?: string;
    createdAt?: string;
  }
): Promise<ShopifyDelivery> {
  const delivery: ShopifyDelivery = {
    deliveryId: input.deliveryId ?? randomUUID(),
    tenantId: input.tenantId,
    event: input.event,
    status: input.status,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.templateName ? { templateName: input.templateName } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.shopifyResourceId ? { shopifyResourceId: input.shopifyResourceId } : {}),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...deliveryKeys(delivery.tenantId, delivery.deliveryId),
        ...delivery,
        GSI1PK: `TENANT#${delivery.tenantId}#SHOPIFY_DELIVERIES`,
        GSI1SK: `${delivery.createdAt}#${delivery.deliveryId}`,
      },
    })
  );
  return delivery;
}

export async function listShopifyDeliveries(
  tenantId: string,
  limit = 50
): Promise<ShopifyDelivery[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#SHOPIFY_DELIVERIES`,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items ?? []).map((item) => stripItem<ShopifyDelivery>(item));
}

export async function deleteShopifyDeliveriesForTenant(tenantId: string): Promise<void> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "SHOPIFY#DELIVERY#",
      },
    })
  );
  for (const item of result.Items ?? []) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
      })
    );
  }
}

export async function deleteShopifyDeliveriesByPhone(
  tenantId: string,
  phoneDigits: string
): Promise<void> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "SHOPIFY#DELIVERY#",
      },
    })
  );
  for (const item of result.Items ?? []) {
    const phone = typeof item.phone === "string" ? item.phone.replace(/\D/g, "") : "";
    if (phone && phone === phoneDigits) {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
        })
      );
    }
  }
}

export type { ShopifyNotificationEvent };
