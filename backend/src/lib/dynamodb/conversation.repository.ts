import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { listBots } from "./bot.repository.js";
import type { Conversation, HandoffMode, Message, WorkflowStatus } from "../../types/index.js";
import { upsertFromConversation } from "./contact.repository.js";

export function normalizeConversation(conv: Conversation): Conversation {
  return {
    ...conv,
    handoffMode: conv.handoffMode ?? "bot",
  };
}

export interface ListConversationsOptions {
  botId?: string;
  handoffMode?: HandoffMode;
  workflowStatus?: WorkflowStatus;
  status?: Conversation["status"];
  assignedAdvisorId?: string;
  limit?: number;
}

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
  return normalizeConversation(rest as Conversation);
}

export async function findConversationById(
  tenantId: string,
  conversationId: string
): Promise<Conversation | null> {
  const bots = await listBots(tenantId);
  for (const bot of bots) {
    const conv = await getConversation(tenantId, bot.botId, conversationId);
    if (conv) return conv;
  }
  return null;
}

export async function updateConversation(
  tenantId: string,
  botId: string,
  conversationId: string,
  updates: Partial<
    Pick<
      Conversation,
      | "handoffMode"
      | "assignedAdvisorId"
      | "handoffAt"
      | "handoffReason"
      | "lastAdvisorNotifiedAt"
      | "contactName"
      | "workflowStatus"
      | "resolvedAt"
      | "firstHumanResponseAt"
      | "csatScore"
      | "csatSubmittedAt"
      | "internalNote"
      | "status"
      | "welcomeSentAt"
    >
  >
): Promise<Conversation | null> {
  const existing = await getConversation(tenantId, botId, conversationId);
  if (!existing) return null;

  const values: Record<string, unknown> = {};
  const parts: string[] = [];
  const expressionNames: Record<string, string> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    expressionNames[`#${key}`] = key;
    values[`:${key}`] = value;
    parts.push(`#${key} = :${key}`);
  }

  if (parts.length === 0) return existing;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: conversationKeys(tenantId, botId, conversationId),
      UpdateExpression: `SET ${parts.join(", ")}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: values,
    })
  );

  return normalizeConversation({ ...existing, ...updates });
}

export async function clearConversationHandoff(
  tenantId: string,
  botId: string,
  conversationId: string
): Promise<Conversation | null> {
  const existing = await getConversation(tenantId, botId, conversationId);
  if (!existing) return null;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: conversationKeys(tenantId, botId, conversationId),
      UpdateExpression:
        "SET handoffMode = :bot REMOVE assignedAdvisorId, handoffAt, handoffReason, lastAdvisorNotifiedAt",
      ExpressionAttributeValues: { ":bot": "bot" },
    })
  );

  const {
    assignedAdvisorId: _a,
    handoffAt: _h,
    handoffReason: _r,
    lastAdvisorNotifiedAt: _n,
    ...cleared
  } = existing;

  return normalizeConversation({
    ...cleared,
    handoffMode: "bot",
  });
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
    return normalizeConversation(rest as Conversation);
  }

  const now = new Date().toISOString();
  const conversationId = `${phoneNumber}-${Date.now()}`;

  const conversation: Conversation = {
    conversationId,
    tenantId,
    botId,
    phoneNumber,
    status: "active",
    handoffMode: "bot",
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

  upsertFromConversation({
    tenantId,
    phoneNumber,
    botId,
    source: "sync",
    ...(contactName ? { displayName: contactName } : {}),
  }).catch((err) => console.warn("Contact sync failed:", err));

  return normalizeConversation(conversation);
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
            UpdateExpression:
              "SET messageCount = messageCount + :inc, lastMessageAt = :now",
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

  const chronological = (result.Items ?? [])
    .map(({ PK, SK, GSI1PK, GSI1SK, ttl, ...rest }) => rest as Message)
    .reverse();

  return dedupeMessagesById(chronological);
}

function dedupeMessagesById(messages: Message[]): Message[] {
  const byMessageId = new Map<string, Message>();
  for (const msg of messages) {
    const existing = byMessageId.get(msg.messageId);
    if (!existing || msg.timestamp >= existing.timestamp) {
      byMessageId.set(msg.messageId, msg);
    }
  }
  return [...byMessageId.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function listConversations(
  tenantId: string,
  options: ListConversationsOptions = {}
): Promise<Conversation[]> {
  const limit = options.limit ?? 20;
  const fetchLimit = Math.min(limit * 5, 100);

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
        Limit: fetchLimit,
      })
    );

  let merged: Conversation[] = [];

  if (options.botId) {
    const result = await queryByBotPk(`TENANT#${tenantId}#BOT#${options.botId}`);
    merged = (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) =>
      normalizeConversation(rest as Conversation)
    );
  } else {
    const bots = await listBots(tenantId);
    if (bots.length === 0) {
      return [];
    }

    const pages = await Promise.all(
      bots.map((b) => queryByBotPk(`TENANT#${tenantId}#BOT#${b.botId}`))
    );

    for (const result of pages) {
      for (const item of result.Items ?? []) {
        const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
        merged.push(normalizeConversation(rest as Conversation));
      }
    }
  }

  if (options.handoffMode) {
    merged = merged.filter((c) => (c.handoffMode ?? "bot") === options.handoffMode);
  }

  if (options.workflowStatus) {
    merged = merged.filter(
      (c) => (c.workflowStatus ?? "open") === options.workflowStatus
    );
  }

  if (options.status) {
    merged = merged.filter((c) => c.status === options.status);
  }

  if (options.assignedAdvisorId) {
    merged = merged.filter((c) => c.assignedAdvisorId === options.assignedAdvisorId);
  }

  merged.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  return merged.slice(0, limit);
}
