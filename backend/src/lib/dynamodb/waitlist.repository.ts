import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { WaitlistEntry, WaitlistScope, WaitlistStatus } from "../../types/index.js";

const waitlistKeys = (tenantId: string, waitlistId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `WAITLIST#${waitlistId}`,
});

function gsi1Keys(entry: WaitlistEntry) {
  const gsi1sk =
    entry.scope === "slot"
      ? `WAITLIST#SLOT#${entry.startAt}#${entry.createdAt}#${entry.waitlistId}`
      : `WAITLIST#DATE#${entry.isoDate}#${entry.createdAt}#${entry.waitlistId}`;
  return {
    GSI1PK: `TENANT#${entry.tenantId}#BOT#${entry.botId}`,
    GSI1SK: gsi1sk,
  };
}

function stripItem(item: Record<string, unknown>): WaitlistEntry {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as WaitlistEntry;
}

export function makeWaitlistId(): string {
  return randomUUID();
}

export async function getWaitlistEntry(
  tenantId: string,
  waitlistId: string
): Promise<WaitlistEntry | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: waitlistKeys(tenantId, waitlistId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listWaitlistForBot(params: {
  tenantId: string;
  botId: string;
  status?: WaitlistStatus;
  scope?: WaitlistScope;
  from?: string;
  to?: string;
}): Promise<WaitlistEntry[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${params.tenantId}#BOT#${params.botId}`,
      },
    })
  );

  let items = (result.Items ?? [])
    .map((item) => stripItem(item))
    .filter((item) => item.waitlistId);

  if (params.status) {
    items = items.filter((item) => item.status === params.status);
  }
  if (params.scope) {
    items = items.filter((item) => item.scope === params.scope);
  }
  if (params.from || params.to) {
    items = items.filter((item) => {
      const key = item.scope === "slot" ? item.startAt?.slice(0, 10) : item.isoDate;
      if (!key) return false;
      if (params.from && key < params.from) return false;
      if (params.to && key > params.to) return false;
      return true;
    });
  }

  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createWaitlistEntry(entry: WaitlistEntry): Promise<WaitlistEntry> {
  const item = {
    ...waitlistKeys(entry.tenantId, entry.waitlistId),
    ...gsi1Keys(entry),
    ...entry,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return stripItem(item);
}

export async function updateWaitlistEntry(
  tenantId: string,
  waitlistId: string,
  patch: Partial<WaitlistEntry>
): Promise<WaitlistEntry | null> {
  const existing = await getWaitlistEntry(tenantId, waitlistId);
  if (!existing) return null;
  const updated: WaitlistEntry = {
    ...existing,
    ...patch,
    waitlistId: existing.waitlistId,
    tenantId: existing.tenantId,
    updatedAt: new Date().toISOString(),
  };
  const item = {
    ...waitlistKeys(tenantId, waitlistId),
    ...gsi1Keys(updated),
    ...updated,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return stripItem(item);
}
