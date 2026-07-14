import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { CatalogProduct } from "../../types/index.js";

const productKeys = (tenantId: string, productId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `PRODUCT#${productId}`,
});

function gsi1Keys(tenantId: string, botId: string, retailerId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#BOT#${botId}`,
    GSI1SK: `PRODUCT#${retailerId}`,
  };
}

function stripItem(item: Record<string, unknown>): CatalogProduct {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as CatalogProduct;
}

export function makeProductId(): string {
  return randomUUID();
}

export async function getProduct(
  tenantId: string,
  productId: string
): Promise<CatalogProduct | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: productKeys(tenantId, productId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function getProductByRetailerId(
  tenantId: string,
  botId: string,
  retailerId: string
): Promise<CatalogProduct | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":gsi1sk": `PRODUCT#${retailerId}`,
      },
      Limit: 1,
    })
  );
  if (!result.Items?.length) return null;
  return stripItem(result.Items[0]);
}

export async function listProductsForBot(
  tenantId: string,
  botId: string
): Promise<CatalogProduct[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":prefix": "PRODUCT#",
      },
    })
  );
  return (result.Items ?? [])
    .map((item) => stripItem(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function countProductsForBot(tenantId: string, botId: string): Promise<number> {
  const products = await listProductsForBot(tenantId, botId);
  return products.length;
}

export async function upsertProduct(product: CatalogProduct): Promise<CatalogProduct> {
  const now = new Date().toISOString();
  const existing = await getProduct(product.tenantId, product.productId);
  const item = {
    ...productKeys(product.tenantId, product.productId),
    ...gsi1Keys(product.tenantId, product.botId, product.retailerId),
    ...product,
    createdAt: existing?.createdAt ?? product.createdAt ?? now,
    updatedAt: now,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return stripItem(item);
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: productKeys(tenantId, productId),
    })
  );
}
