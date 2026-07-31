import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { listBots } from "./bot.repository.js";
import type { Conversation, HandoffMode, Message, WorkflowStatus, Channel } from "../../types/index.js";
import { conversationLookupGsi1pk, legacyPhoneGsi1pk } from "../channels/keys.js";
import { upsertFromConversation } from "./contact.repository.js";
import { publishRealtimeEventSafe } from "../realtime/publish.js";

const REALTIME_CONVERSATION_FIELDS = new Set([
  "handoffMode",
  "assignedAdvisorId",
  "workflowStatus",
  "status",
]);

export function normalizeConversation(conv: Conversation): Conversation {
  const channel: Channel = conv.channel ?? "whatsapp";
  const participantId = conv.participantId ?? conv.phoneNumber;
  return {
    ...conv,
    channel,
    participantId,
    phoneNumber: conv.phoneNumber ?? participantId,
    handoffMode: conv.handoffMode ?? "bot",
  };
}

export interface ListConversationsOptions {
  botId?: string;
  channel?: Channel;
  handoffMode?: HandoffMode;
  workflowStatus?: WorkflowStatus;
  status?: Conversation["status"];
  assignedAdvisorId?: string;
  assignment?: "assigned" | "unassigned";
  limit?: number;
  cursor?: string;
}

export interface ListConversationsResult {
  items: Conversation[];
  nextCursor?: string;
}

interface ConversationCursor {
  lastMessageAt: string;
  conversationId: string;
}

function decodeConversationCursor(cursor: string): ConversationCursor | undefined {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as ConversationCursor;
  } catch {
    return undefined;
  }
}

function encodeConversationCursor(cursor: ConversationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function isAfterCursor(conv: Conversation, cursor: ConversationCursor): boolean {
  if (conv.lastMessageAt < cursor.lastMessageAt) return true;
  if (conv.lastMessageAt > cursor.lastMessageAt) return false;
  return conv.conversationId < cursor.conversationId;
}

export function matchesConversationAssignment(
  conversation: Conversation,
  assignment?: "assigned" | "unassigned"
): boolean {
  if (!assignment) return true;
  if ((conversation.handoffMode ?? "bot") !== "human") return false;
  if ((conversation.workflowStatus ?? "open") === "resolved") return false;
  if (assignment === "unassigned") return !conversation.assignedAdvisorId;
  return !!conversation.assignedAdvisorId;
}

async function queryAllConversationsByBot(
  tenantId: string,
  botId: string
): Promise<Conversation[]> {
  const items: Conversation[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}#BOT#${botId}`,
          ":sk": "CONV#",
        },
        ScanIndexForward: false,
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        Limit: 100,
      })
    );

    for (const item of result.Items ?? []) {
      const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
      items.push(normalizeConversation(rest as Conversation));
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
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
      | "copilotSummary"
      | "detectedIntent"
      | "copilotGeneratedAt"
      | "status"
      | "welcomeSentAt"
      | "activeFlowRunId"
      | "pendingMetaFlowId"
      | "metaFlowToken"
      | "emailSubject"
      | "emailThreadMessageId"
      | "locale"
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

  const updated = normalizeConversation({ ...existing, ...updates });

  const shouldPublish = Object.keys(updates).some((key) =>
    REALTIME_CONVERSATION_FIELDS.has(key)
  );
  if (shouldPublish) {
    publishRealtimeEventSafe(tenantId, {
      type: "conversation.updated",
      conversation: updated,
    });
  }

  return updated;
}

export async function claimConversationAssignment(
  tenantId: string,
  botId: string,
  conversationId: string,
  advisorId: string
): Promise<Conversation> {
  const existing = await getConversation(tenantId, botId, conversationId);
  if (!existing) {
    const error = new Error("Conversation not found");
    (error as Error & { statusCode: number }).statusCode = 404;
    throw error;
  }

  if (existing.assignedAdvisorId === advisorId) {
    return existing;
  }

  if (existing.assignedAdvisorId) {
    const error = new Error("Conversation already assigned to another advisor");
    (error as Error & { statusCode: number }).statusCode = 409;
    throw error;
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: conversationKeys(tenantId, botId, conversationId),
        UpdateExpression: "SET assignedAdvisorId = :aid",
        ConditionExpression: "attribute_not_exists(assignedAdvisorId)",
        ExpressionAttributeValues: { ":aid": advisorId },
      })
    );
  } catch (err) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      const conflict = new Error("Conversation already assigned to another advisor");
      (conflict as Error & { statusCode: number }).statusCode = 409;
      throw conflict;
    }
    throw err;
  }

  const updated = normalizeConversation({ ...existing, assignedAdvisorId: advisorId });

  publishRealtimeEventSafe(tenantId, {
    type: "conversation.handoff",
    conversation: updated,
  });

  return updated;
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

  const updated = normalizeConversation({
    ...cleared,
    handoffMode: "bot",
  });

  publishRealtimeEventSafe(tenantId, {
    type: "conversation.updated",
    conversation: updated,
  });

  return updated;
}

export async function clearActiveFlowRun(
  tenantId: string,
  botId: string,
  conversationId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: conversationKeys(tenantId, botId, conversationId),
      UpdateExpression: "REMOVE activeFlowRunId",
    })
  );
}

export async function clearMetaFlowSession(
  tenantId: string,
  botId: string,
  conversationId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: conversationKeys(tenantId, botId, conversationId),
      UpdateExpression: "REMOVE pendingMetaFlowId, metaFlowToken",
    })
  );
}

export async function setActiveFlowRun(
  tenantId: string,
  botId: string,
  conversationId: string,
  runId: string
): Promise<void> {
  await updateConversation(tenantId, botId, conversationId, { activeFlowRunId: runId });
}

export async function setMetaFlowSession(
  tenantId: string,
  botId: string,
  conversationId: string,
  metaFlowId: string,
  metaFlowToken: string
): Promise<void> {
  await updateConversation(tenantId, botId, conversationId, {
    pendingMetaFlowId: metaFlowId,
    metaFlowToken,
  });
}

export async function getOrCreateConversation(
  tenantId: string,
  botId: string,
  channel: Channel,
  participantId: string,
  contactName?: string
): Promise<Conversation> {
  const gsi1pk = conversationLookupGsi1pk(tenantId, botId, channel, participantId);

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

  if (channel === "whatsapp") {
    const legacyGsi = legacyPhoneGsi1pk(tenantId, botId, participantId);
    const legacy = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":gsi1pk": legacyGsi, ":status": "active" },
        Limit: 1,
      })
    );
    if (legacy.Items?.length) {
      const { PK, SK, GSI1PK, GSI1SK, ...rest } = legacy.Items[0];
      const conv = normalizeConversation(rest as Conversation);
      if (!conv.channel || !conv.participantId) {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: conversationKeys(tenantId, botId, conv.conversationId),
            UpdateExpression:
              "SET #channel = :channel, participantId = :participantId, GSI1PK = :gsi1pk",
            ExpressionAttributeNames: { "#channel": "channel" },
            ExpressionAttributeValues: {
              ":channel": "whatsapp",
              ":participantId": participantId,
              ":gsi1pk": gsi1pk,
            },
          })
        );
        return normalizeConversation({
          ...conv,
          channel: "whatsapp",
          participantId,
        });
      }
      return conv;
    }
  }

  const now = new Date().toISOString();
  const conversationId =
    channel === "whatsapp"
      ? `${participantId}-${Date.now()}`
      : `${channel}-${participantId}-${Date.now()}`;

  const phoneNumber = channel === "whatsapp" || channel === "sms" ? participantId : "";

  const conversation: Conversation = {
    conversationId,
    tenantId,
    botId,
    channel,
    participantId,
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

  if (channel === "whatsapp" && phoneNumber) {
    upsertFromConversation({
      tenantId,
      phoneNumber,
      botId,
      source: "sync",
      ...(contactName ? { displayName: contactName } : {}),
    }).catch((err) => console.warn("Contact sync failed:", err));
  }

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

  const conversation = await getConversation(message.tenantId, botId, message.conversationId);
  if (conversation) {
    publishRealtimeEventSafe(message.tenantId, {
      type: "message.created",
      conversationId: message.conversationId,
      message,
      conversation: {
        ...conversation,
        lastMessageAt: now,
        messageCount: (conversation.messageCount ?? 0) + 1,
      },
    });
  }
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
): Promise<ListConversationsResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursor = options.cursor ? decodeConversationCursor(options.cursor) : undefined;

  let merged: Conversation[] = [];

  if (options.botId) {
    merged = await queryAllConversationsByBot(tenantId, options.botId);
  } else {
    const bots = await listBots(tenantId);
    if (bots.length === 0) {
      return { items: [] };
    }

    const pages = await Promise.all(
      bots.map((b) => queryAllConversationsByBot(tenantId, b.botId))
    );

    for (const page of pages) {
      merged.push(...page);
    }
  }

  if (options.channel) {
    merged = merged.filter((c) => (c.channel ?? "whatsapp") === options.channel);
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

  if (options.assignment) {
    merged = merged.filter((c) => matchesConversationAssignment(c, options.assignment));
  }

  merged.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  if (cursor) {
    merged = merged.filter((c) => isAfterCursor(c, cursor));
  }

  const items = merged.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor =
    items.length === limit && last
      ? encodeConversationCursor({
          lastMessageAt: last.lastMessageAt,
          conversationId: last.conversationId,
        })
      : undefined;

  return { items, ...(nextCursor ? { nextCursor } : {}) };
}

async function queryAllMessageKeys(
  tenantId: string,
  conversationId: string
): Promise<Array<{ PK: string; SK: string }>> {
  const keys: Array<{ PK: string; SK: string }> = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}#CONV#${conversationId}`,
          ":sk": "MSG#",
        },
        ProjectionExpression: "PK, SK",
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        Limit: 100,
      })
    );

    for (const item of result.Items ?? []) {
      keys.push({ PK: item.PK as string, SK: item.SK as string });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return keys;
}

export async function deleteConversation(
  tenantId: string,
  botId: string,
  conversationId: string
): Promise<boolean> {
  const existing = await getConversation(tenantId, botId, conversationId);
  if (!existing) return false;

  const deleteRequests: Array<{ DeleteRequest: { Key: { PK: string; SK: string } } }> = [
    { DeleteRequest: { Key: conversationKeys(tenantId, botId, conversationId) } },
    ...(await queryAllMessageKeys(tenantId, conversationId)).map((key) => ({
      DeleteRequest: { Key: key },
    })),
  ];

  if (existing.activeFlowRunId) {
    deleteRequests.push({
      DeleteRequest: {
        Key: {
          PK: `TENANT#${tenantId}`,
          SK: `FLOWRUN#${existing.activeFlowRunId}`,
        },
      },
    });
  }

  for (let i = 0; i < deleteRequests.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: deleteRequests.slice(i, i + 25) },
      })
    );
  }

  return true;
}
