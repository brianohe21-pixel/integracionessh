import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  putWabaLookup,
  deleteWabaLookup,
  deleteTelephonyNumberLookup,
} from "./bot-lookup.repository.js";
import { docClient, TABLE_NAME } from "./client.js";
import { normalizeE164 } from "../telnyx/phone.js";
import type { Bot } from "../../types/index.js";

const keys = (tenantId: string, botId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BOT#${botId}`,
});

export async function getBot(tenantId: string, botId: string): Promise<Bot | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, botId),
    })
  );

  if (!result.Item) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as Bot;
}

export async function getBotByPhoneNumberId(phoneNumberId: string): Promise<Bot | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": `PHONE#${phoneNumberId}` },
      Limit: 1,
    })
  );

  if (!result.Items?.length) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Items[0];
  return rest as Bot;
}

export async function createBot(bot: Bot): Promise<void> {
  const item: Record<string, unknown> = {
    ...keys(bot.tenantId, bot.botId),
    ...bot,
  };

  if (bot.phoneNumberId.trim()) {
    item.GSI1PK = `PHONE#${bot.phoneNumberId}`;
    item.GSI1SK = `BOT#${bot.botId}`;
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(SK)",
    })
  );

  if (bot.whatsappBusinessAccountId?.trim()) {
    await putWabaLookup(bot.whatsappBusinessAccountId, bot.tenantId, bot.botId);
  }
}

export async function updateBot(
  tenantId: string,
  botId: string,
  updates: Partial<Omit<Bot, "tenantId" | "botId" | "createdAt">>
): Promise<Bot> {
  const setExpressions: string[] = [];
  const removeExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  const payload = { ...updates, updatedAt: new Date().toISOString() };

  if (updates.phoneNumberId !== undefined) {
    if (updates.phoneNumberId.trim()) {
      payload.phoneNumberId = updates.phoneNumberId;
      setExpressions.push("#GSI1PK = :gsi1pk", "#GSI1SK = :gsi1sk");
      expressionAttributeNames["#GSI1PK"] = "GSI1PK";
      expressionAttributeNames["#GSI1SK"] = "GSI1SK";
      expressionAttributeValues[":gsi1pk"] = `PHONE#${updates.phoneNumberId}`;
      expressionAttributeValues[":gsi1sk"] = `BOT#${botId}`;
    } else {
      payload.phoneNumberId = "";
      removeExpressions.push("#GSI1PK", "#GSI1SK");
      expressionAttributeNames["#GSI1PK"] = "GSI1PK";
      expressionAttributeNames["#GSI1SK"] = "GSI1SK";
    }
  }

  Object.entries(payload).forEach(([key, value]) => {
    expressionAttributeNames[`#${key}`] = key;

    if (value === undefined || value === null) {
      removeExpressions.push(`#${key}`);
      return;
    }

    setExpressions.push(`#${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
  });

  const updateParts: string[] = [];
  if (setExpressions.length > 0) {
    updateParts.push(`SET ${setExpressions.join(", ")}`);
  }
  if (removeExpressions.length > 0) {
    updateParts.push(`REMOVE ${removeExpressions.join(", ")}`);
  }

  if (updateParts.length === 0) {
    const existing = await getBot(tenantId, botId);
    if (!existing) {
      throw Object.assign(new Error("Bot not found"), { statusCode: 404 });
    }
    return existing;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, botId),
      UpdateExpression: updateParts.join(" "),
      ExpressionAttributeNames: expressionAttributeNames,
      ...(Object.keys(expressionAttributeValues).length > 0
        ? { ExpressionAttributeValues: expressionAttributeValues }
        : {}),
      ConditionExpression: "attribute_exists(PK)",
      ReturnValues: "ALL_NEW",
    })
  );

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Attributes ?? {};
  const updated = rest as Bot;

  if (updates.whatsappBusinessAccountId?.trim()) {
    await putWabaLookup(updates.whatsappBusinessAccountId, tenantId, botId);
  }

  return updated;
}

export async function deleteBot(tenantId: string, botId: string): Promise<void> {
  const existing = await getBot(tenantId, botId);
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, botId),
      ConditionExpression: "attribute_exists(PK)",
    })
  );
  if (existing?.whatsappBusinessAccountId?.trim()) {
    await deleteWabaLookup(existing.whatsappBusinessAccountId);
  }
  if (existing?.telephonyPhoneNumber?.trim()) {
    await deleteTelephonyNumberLookup(normalizeE164(existing.telephonyPhoneNumber));
  }
}

export async function listBots(tenantId: string): Promise<Bot[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "BOT#",
      },
      ConsistentRead: true,
    })
  );

  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as Bot);
}
