import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { Channel } from "../../types/index.js";

const indexKeys = (tenantId: string, contactId: string, botId: string, conversationId: string) => ({
  PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
  SK: `CONV#${botId}#${conversationId}`,
});

export interface ContactConversationRef {
  botId: string;
  conversationId: string;
  channel: Channel;
  lastMessageAt: string;
}

function parseConversationSk(sk: string): { botId: string; conversationId: string } | null {
  if (!sk.startsWith("CONV#")) return null;
  const rest = sk.slice("CONV#".length);
  const separator = rest.indexOf("#");
  if (separator < 0) return null;
  return {
    botId: rest.slice(0, separator),
    conversationId: rest.slice(separator + 1),
  };
}

export async function indexContactConversation(ref: {
  tenantId: string;
  contactId: string;
} & ContactConversationRef): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...indexKeys(ref.tenantId, ref.contactId, ref.botId, ref.conversationId),
        entityType: "ContactConversationIndex",
        channel: ref.channel,
        lastMessageAt: ref.lastMessageAt,
        contactId: ref.contactId,
      },
    })
  );
}

export async function listContactConversations(
  tenantId: string,
  contactId: string
): Promise<ContactConversationRef[]> {
  const items: ContactConversationRef[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}#CONTACT#${contactId}`,
        },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );

    for (const item of result.Items ?? []) {
      if (item.entityType !== "ContactConversationIndex") continue;
      const parsed = parseConversationSk(item.SK as string);
      if (!parsed) continue;
      items.push({
        botId: parsed.botId,
        conversationId: parsed.conversationId,
        channel: item.channel as Channel,
        lastMessageAt: (item.lastMessageAt as string) ?? "",
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}
