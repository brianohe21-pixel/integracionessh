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

function messengerPageKey(pageId: string) {
  return {
    PK: `LOOKUP#MESSENGER_PAGE#${pageId}`,
    SK: "META",
  };
}

function smsNumberKey(number: string) {
  return {
    PK: `LOOKUP#SMS#${number}`,
    SK: "META",
  };
}

function emailAddressKey(address: string) {
  return {
    PK: `LOOKUP#EMAIL#${address.toLowerCase()}`,
    SK: "META",
  };
}

function telegramBotKey(botId: string) {
  return {
    PK: `LOOKUP#TELEGRAM#${botId}`,
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

export async function putMessengerPageLookup(
  pageId: string,
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...messengerPageKey(pageId),
        tenantId,
        botId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteMessengerPageLookup(pageId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: messengerPageKey(pageId),
    })
  );
}

export async function getBotByMessengerPageId(
  pageId: string
): Promise<{ tenantId: string; botId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: messengerPageKey(pageId),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    botId: result.Item.botId as string,
  };
}

export async function putSmsNumberLookup(
  number: string,
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...smsNumberKey(number),
        tenantId,
        botId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteSmsNumberLookup(number: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: smsNumberKey(number),
    })
  );
}

export async function getBotBySmsNumber(
  number: string
): Promise<{ tenantId: string; botId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: smsNumberKey(number),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    botId: result.Item.botId as string,
  };
}

export async function putEmailAddressLookup(
  address: string,
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...emailAddressKey(address),
        tenantId,
        botId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteEmailAddressLookup(address: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: emailAddressKey(address),
    })
  );
}

export async function getBotByEmailAddress(
  address: string
): Promise<{ tenantId: string; botId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: emailAddressKey(address),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    botId: result.Item.botId as string,
  };
}

export async function putTelegramBotLookup(
  botId: string,
  tenantId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...telegramBotKey(botId),
        tenantId,
        botId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteTelegramBotLookup(botId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: telegramBotKey(botId),
    })
  );
}

export async function getBotByTelegramBotId(
  botId: string
): Promise<{ tenantId: string; botId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: telegramBotKey(botId),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    botId: result.Item.botId as string,
  };
}
