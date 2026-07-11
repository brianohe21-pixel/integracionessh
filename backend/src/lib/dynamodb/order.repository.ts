import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { CatalogOrder, OrderStatus } from "../../types/index.js";

const orderKeys = (tenantId: string, orderId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `ORDER#${orderId}`,
});

function gsi1Keys(tenantId: string, botId: string, createdAt: string, orderId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#BOT#${botId}`,
    GSI1SK: `CREATED#${createdAt}#${orderId}`,
  };
}

function stripItem(item: Record<string, unknown>): CatalogOrder {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  const order = rest as unknown as CatalogOrder;
  if (!order.orderId && typeof SK === "string" && SK.startsWith("ORDER#")) {
    order.orderId = SK.slice("ORDER#".length);
  }
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items : [],
    subtotalInCents:
      typeof order.subtotalInCents === "number" && Number.isFinite(order.subtotalInCents)
        ? order.subtotalInCents
        : 0,
  };
}

export function makeOrderId(): string {
  return randomUUID();
}

export async function getOrder(
  tenantId: string,
  orderId: string
): Promise<CatalogOrder | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: orderKeys(tenantId, orderId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function createOrderRecord(order: CatalogOrder): Promise<CatalogOrder> {
  const item = {
    ...orderKeys(order.tenantId, order.orderId),
    ...gsi1Keys(order.tenantId, order.botId, order.createdAt, order.orderId),
    ...order,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return order;
}

export async function updateOrder(
  tenantId: string,
  orderId: string,
  updates: Partial<
    Pick<
      CatalogOrder,
      | "status"
      | "paymentId"
      | "internalNotes"
      | "items"
      | "subtotalInCents"
      | "updatedAt"
    >
  >
): Promise<CatalogOrder | null> {
  const existing = await getOrder(tenantId, orderId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: CatalogOrder = {
    ...existing,
    ...updates,
    updatedAt: updates.updatedAt ?? now,
  };

  const item = {
    ...orderKeys(tenantId, orderId),
    ...gsi1Keys(updated.tenantId, updated.botId, updated.createdAt, updated.orderId),
    ...updated,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return updated;
}

export async function listOrdersForBot(params: {
  tenantId: string;
  botId: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<CatalogOrder[]> {
  const expressionValues: Record<string, string> = {
    ":gsi1pk": `TENANT#${params.tenantId}#BOT#${params.botId}`,
  };
  let keyCondition = "GSI1PK = :gsi1pk";
  if (params.from && params.to) {
    keyCondition += " AND GSI1SK BETWEEN :from AND :to";
    expressionValues[":from"] = `CREATED#${params.from}`;
    expressionValues[":to"] = `CREATED#${params.to}\uffff`;
  } else if (params.from) {
    keyCondition += " AND GSI1SK >= :from";
    expressionValues[":from"] = `CREATED#${params.from}`;
  } else if (params.to) {
    keyCondition += " AND GSI1SK <= :to";
    expressionValues[":to"] = `CREATED#${params.to}\uffff`;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: false,
      Limit: params.limit ?? 100,
    })
  );

  let items = (result.Items ?? []).map((item) => stripItem(item));
  if (params.status) {
    items = items.filter((o) => o.status === params.status);
  }
  return items;
}

export async function countOrdersForTenantInMonth(
  tenantId: string,
  yearMonth: string
): Promise<number> {
  const from = `${yearMonth}-01T00:00:00.000Z`;
  const to = `${yearMonth}-31T23:59:59.999Z`;
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      FilterExpression: "createdAt BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "ORDER#",
        ":from": from,
        ":to": to,
      },
      Select: "COUNT",
    })
  );
  return result.Count ?? 0;
}
