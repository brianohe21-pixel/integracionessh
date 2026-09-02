import { randomUUID } from "crypto";
import {
  DeleteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { WhatsAppChannel } from "../../types/index.js";

const channelKeys = (tenantId: string, botId: string, channelId: string) => ({
  PK: `TENANT#${tenantId}#BOT#${botId}`,
  SK: `WACHANNEL#${channelId}`,
});

function phoneLookupKey(phoneNumberId: string) {
  return {
    PK: `LOOKUP#WHATSAPP_PHONE#${phoneNumberId}`,
    SK: "META",
  };
}

export async function listWhatsAppChannels(
  tenantId: string,
  botId: string
): Promise<WhatsAppChannel[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": "WACHANNEL#",
      },
    })
  );
  return (result.Items ?? []).map(({ PK, SK, ...rest }) => rest as WhatsAppChannel);
}

export async function countWhatsAppChannels(
  tenantId: string,
  botId: string
): Promise<number> {
  const channels = await listWhatsAppChannels(tenantId, botId);
  return channels.filter((c) => c.status !== "disconnected").length;
}

export async function getWhatsAppChannel(
  tenantId: string,
  botId: string,
  channelId: string
): Promise<WhatsAppChannel | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: channelKeys(tenantId, botId, channelId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as WhatsAppChannel;
}

export async function getWhatsAppChannelByPhoneNumberId(
  phoneNumberId: string
): Promise<WhatsAppChannel | null> {
  const lookup = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: phoneLookupKey(phoneNumberId),
    })
  );
  if (!lookup.Item) return null;
  const tenantId = lookup.Item.tenantId as string;
  const botId = lookup.Item.botId as string;
  const channelId = lookup.Item.channelId as string;
  return getWhatsAppChannel(tenantId, botId, channelId);
}

export async function createWhatsAppChannel(
  channel: Omit<WhatsAppChannel, "channelId" | "createdAt" | "updatedAt"> & {
    channelId?: string;
  }
): Promise<WhatsAppChannel> {
  const now = new Date().toISOString();
  const channelId = channel.channelId ?? randomUUID();
  const item: WhatsAppChannel = {
    ...channel,
    channelId,
    createdAt: now,
    updatedAt: now,
  };

  const transactItems: Array<Record<string, unknown>> = [
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          ...channelKeys(channel.tenantId, channel.botId, channelId),
          ...item,
        },
        ConditionExpression: "attribute_not_exists(SK)",
      },
    },
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          ...phoneLookupKey(channel.phoneNumberId),
          tenantId: channel.tenantId,
          botId: channel.botId,
          channelId,
          accountId: channel.accountId,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      },
    },
  ];

  if (channel.isDefault) {
    const existing = await listWhatsAppChannels(channel.tenantId, channel.botId);
    for (const other of existing) {
      if (other.isDefault) {
        transactItems.push({
          Update: {
            TableName: TABLE_NAME,
            Key: channelKeys(channel.tenantId, channel.botId, other.channelId),
            UpdateExpression: "SET isDefault = :false, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":false": false,
              ":updatedAt": now,
            },
          },
        });
      }
    }
  }

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: transactItems as NonNullable<
        ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
      >,
    })
  );
  return item;
}

export async function updateWhatsAppChannel(
  tenantId: string,
  botId: string,
  channelId: string,
  updates: Partial<
    Pick<
      WhatsAppChannel,
      | "label"
      | "status"
      | "isDefault"
      | "displayPhoneNumber"
      | "whatsappOnboardingMode"
      | "isOnBizApp"
      | "platformType"
      | "whatsappSyncStatus"
      | "whatsappDisconnectedAt"
      | "whatsappDisconnectionReason"
    >
  >
): Promise<WhatsAppChannel | null> {
  const existing = await getWhatsAppChannel(tenantId, botId, channelId);
  if (!existing) return null;

  if (updates.isDefault) {
    const all = await listWhatsAppChannels(tenantId, botId);
    const now = new Date().toISOString();
    const transactItems = all
      .filter((c) => c.channelId !== channelId && c.isDefault)
      .map((c) => ({
        Update: {
          TableName: TABLE_NAME,
          Key: channelKeys(tenantId, botId, c.channelId),
          UpdateExpression: "SET isDefault = :false, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":false": false,
            ":updatedAt": now,
          },
        },
      }));
    if (transactItems.length) {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    }
  }

  const setExpressions: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    setExpressions.push(`#${key} = :${key}`);
  }

  if (!setExpressions.length) return existing;

  const updatedAt = new Date().toISOString();
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = updatedAt;
  setExpressions.push("#updatedAt = :updatedAt");

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: channelKeys(tenantId, botId, channelId),
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  return { ...existing, ...updates, updatedAt };
}

export async function deleteWhatsAppChannel(
  tenantId: string,
  botId: string,
  channelId: string
): Promise<void> {
  const existing = await getWhatsAppChannel(tenantId, botId, channelId);
  if (!existing) return;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: channelKeys(tenantId, botId, channelId),
    })
  );

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: phoneLookupKey(existing.phoneNumberId),
    })
  );
}

export async function getDefaultWhatsAppChannel(
  tenantId: string,
  botId: string
): Promise<WhatsAppChannel | null> {
  const channels = await listWhatsAppChannels(tenantId, botId);
  const active = channels.filter((c) => c.status === "active");
  return active.find((c) => c.isDefault) ?? active[0] ?? null;
}
