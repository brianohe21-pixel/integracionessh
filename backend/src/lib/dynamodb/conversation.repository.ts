import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { listBots } from "./bot.repository.js";
import type { Conversation, Message } from "../../types/index.js";

const conversationKeys = (tenantId: string, botId: string, conversationId: string) => ({
  PK: `TENANT#${tenantId}#BOT#${botId}`,
  SK: `CONV#${conversationId}`,
});

const messageKeys = (tenantId: string, conversationId: string, timestamp: string, messageId: string) => ({
  PK: `TENANT#${tenantId}#CONV#${conversationId}`,
  SK: `MSG#${timestamp}#${messageId}`,
});

export async function getConversation(
  tenantId: string,
  botId: string,
  conversationId: string
): Promise<Conversation | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: conversationKeys(tenantId, botId, conversationId),
    })
  );

  if (!result.Item) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as Conversation;
}

export async function getOrCreateConversation(
  tenantId: string,
  botId: string,
  phoneNumber: string,
  contactName?: string
): Promise<Conversation> {
  const gsi1pk = `TENANT#${tenantId}#BOT#${botId}#PHONE#${phoneNumber}`;

  const existing = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":gsi1pk": gsi1pk, ":status": "active" },
      Limit: 1,
    })
  );

  if (existing.Items?.length) {
    const { PK, SK, GSI1PK, GSI1SK, ...rest } = existing.Items[0];
    return rest as Conversation;
  }

  const now = new Date().toISOString();
  const conversationId = `${phoneNumber}-${Date.now()}`;

  const conversation: Conversation = {
    conversationId,
    tenantId,
    botId,
    phoneNumber,
    status: "active",
    messageCount: 0,
    lastMessageAt: now,
    createdAt: now,
    ...(contactName !== undefined && contactName !== ""
      ? { contactName }
      : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...conversationKeys(tenantId, botId, conversationId),
        GSI1PK: gsi1pk,
        GSI1SK: `CONV#${now}`,
        ...conversation,
      },
    })
  );

  return conversation;
}

export async function addMessage(message: Message, botId: string): Promise<void> {
  const now = message.timestamp;

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...messageKeys(message.tenantId, message.conversationId, now, message.messageId),
              GSI1PK: `TENANT#${message.tenantId}#CONV#${message.conversationId}`,
              GSI1SK: `MSG#${now}`,
              ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
              ...message,
            },
          },
        },
        {
          Update: {
            TableName: TABLE_NAME,
            Key: {
              PK: `TENANT#${message.tenantId}#BOT#${botId}`,
              SK: `CONV#${message.conversationId}`,
            },
            UpdateExpression: "SET messageCount = messageCount + :inc, lastMessageAt = :now",
            ExpressionAttributeValues: {
              ":inc": 1,
              ":now": now,
            },
          },
        },
      ],
    })
  );
}

export async function getConversationMessages(
  tenantId: string,
  conversationId: string,
  limit = 20
): Promise<Message[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#CONV#${conversationId}`,
        ":sk": "MSG#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items ?? [])
    .map(({ PK, SK, GSI1PK, GSI1SK, ttl, ...rest }) => rest as Message)
    .reverse();
}

export async function listConversations(
  tenantId: string,
  botId?: string,
  limit = 20
): Promise<Conversation[]> {
  const queryByBotPk = (pk: string) =>
    docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":sk": "CONV#",
        },
        ScanIndexForward: false,
        Limit: limit,
      })
    );

  if (botId) {
    const result = await queryByBotPk(`TENANT#${tenantId}#BOT#${botId}`);
    return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as Conversation);
  }

  const bots = await listBots(tenantId);
  if (bots.length === 0) {
    return [];
  }

  const pages = await Promise.all(
    bots.map((b) => queryByBotPk(`TENANT#${tenantId}#BOT#${b.botId}`))
  );

  const merged: Conversation[] = [];
  for (const result of pages) {
    for (const item of result.Items ?? []) {
      const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
      merged.push(rest as Conversation);
    }
  }

  merged.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  return merged.slice(0, limit);
}
