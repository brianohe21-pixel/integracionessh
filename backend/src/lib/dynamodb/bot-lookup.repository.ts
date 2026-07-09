import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

function instagramPageKey(pageId: string) {
  return {
    PK: `LOOKUP#INSTAGRAM_PAGE#${pageId}`,
    SK: "META",
  };
}

function widgetKeyKey(widgetKey: string) {
  return {
    PK: `LOOKUP#WIDGET#${widgetKey}`,
    SK: "META",
  };
}

function calendarPublicKeyKey(publicKey: string) {
  return {
    PK: `LOOKUP#CALENDAR#${publicKey}`,
    SK: "META",
  };
}

export async function putInstagramPageLookup(
  pageId: string,
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...instagramPageKey(pageId),
        tenantId,
        botId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteInstagramPageLookup(pageId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: instagramPageKey(pageId),
    })
  );
}

export async function getBotByInstagramPageId(
  pageId: string
): Promise<{ tenantId: string; botId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: instagramPageKey(pageId),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    botId: result.Item.botId as string,
  };
}

export async function putWidgetKeyLookup(
  widgetKey: string,
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...widgetKeyKey(widgetKey),
        tenantId,
        botId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteWidgetKeyLookup(widgetKey: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: widgetKeyKey(widgetKey),
    })
  );
}

export async function getBotByWidgetKey(
  widgetKey: string
): Promise<{ tenantId: string; botId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: widgetKeyKey(widgetKey),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    botId: result.Item.botId as string,
  };
}

export async function putCalendarPublicKeyLookup(
  publicKey: string,
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...calendarPublicKeyKey(publicKey),
        tenantId,
        botId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteCalendarPublicKeyLookup(publicKey: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: calendarPublicKeyKey(publicKey),
    })
  );
}

export async function getBotByCalendarPublicKey(
  publicKey: string
): Promise<{ tenantId: string; botId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: calendarPublicKeyKey(publicKey),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    botId: result.Item.botId as string,
  };
}
