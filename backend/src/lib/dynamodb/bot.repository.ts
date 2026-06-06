import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
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
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys(bot.tenantId, bot.botId),
        GSI1PK: `PHONE#${bot.phoneNumberId}`,
        GSI1SK: `BOT#${bot.botId}`,
        ...bot,
      },
      ConditionExpression: "attribute_not_exists(SK)",
    })
  );
}

export async function updateBot(
  tenantId: string,
  botId: string,
  updates: Partial<Omit<Bot, "tenantId" | "botId" | "createdAt">>
): Promise<Bot> {
  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  const payload = { ...updates, updatedAt: new Date().toISOString() };

  if (updates.phoneNumberId) {
    payload.phoneNumberId = updates.phoneNumberId;
    updateExpression.push("#GSI1PK = :gsi1pk");
    expressionAttributeNames["#GSI1PK"] = "GSI1PK";
    expressionAttributeValues[":gsi1pk"] = `PHONE#${updates.phoneNumberId}`;
  }

  Object.entries(payload).forEach(([key, value]) => {
    updateExpression.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = value;
  });

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, botId),
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: "attribute_exists(PK)",
      ReturnValues: "ALL_NEW",
    })
  );

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Attributes ?? {};
  return rest as Bot;
}

export async function deleteBot(tenantId: string, botId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, botId),
      ConditionExpression: "attribute_exists(PK)",
    })
  );
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
