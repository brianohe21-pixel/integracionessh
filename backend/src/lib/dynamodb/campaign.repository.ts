import { randomUUID } from "crypto";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Campaign, CampaignStatus, CampaignRecipient } from "../../types/index.js";

const RECIPIENT_TTL_SECONDS = 7 * 24 * 60 * 60;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function campaignKeys(tenantId: string, campaignId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CAMPAIGN#${campaignId}`,
    GSI1PK: `CAMPAIGN#${campaignId}`,
    GSI1SK: `CAMPAIGN#${campaignId}`,
  };
}

function recipientKeys(tenantId: string, campaignId: string, idx: number) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CAMPREC#${campaignId}#${String(idx).padStart(10, "0")}`,
  };
}

function phoneLookupKeys(tenantId: string, phone: string, campaignId: string) {
  return {
    PK: `TENANT#${tenantId}#PHONE#${normalizePhone(phone)}`,
    SK: `CAMPLOOKUP#${campaignId}`,
  };
}

export async function createCampaign(
  input: Omit<Campaign, "sent" | "failed" | "deliveredCount" | "readCount" | "deliveryFailed" | "replyCount"> & {
    sent?: number;
    failed?: number;
    deliveredCount?: number;
    readCount?: number;
    deliveryFailed?: number;
    replyCount?: number;
  }
): Promise<Campaign> {
  const campaign: Campaign = {
    sent: 0,
    failed: 0,
    deliveredCount: 0,
    readCount: 0,
    deliveryFailed: 0,
    replyCount: 0,
    ...input,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...campaignKeys(campaign.tenantId, campaign.campaignId), ...campaign },
    })
  );

  return campaign;
}

export async function getCampaign(
  tenantId: string,
  campaignId: string
): Promise<Campaign | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
    })
  );

  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  const campaign = rest as Campaign;
  if (campaign.replyCount === undefined) campaign.replyCount = 0;
  return campaign;
}

export async function listCampaigns(
  tenantId: string,
  limit = 50
): Promise<Campaign[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "CAMPAIGN#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => {
    const campaign = rest as Campaign;
    if (campaign.replyCount === undefined) campaign.replyCount = 0;
    return campaign;
  });
}

export async function updateCampaignStatus(
  tenantId: string,
  campaignId: string,
  status: CampaignStatus,
  extra?: { startedAt?: string; completedAt?: string }
): Promise<void> {
  const now = new Date().toISOString();
  let updateExpression = "SET #status = :status, updatedAt = :now";
  const exprValues: Record<string, unknown> = { ":status": status, ":now": now };
  const exprNames: Record<string, string> = { "#status": "status" };

  if (extra?.startedAt) {
    updateExpression += ", startedAt = :startedAt";
    exprValues[":startedAt"] = extra.startedAt;
  }
  if (extra?.completedAt) {
    updateExpression += ", completedAt = :completedAt";
    exprValues[":completedAt"] = extra.completedAt;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    })
  );
}

export async function updateCampaignDraft(
  tenantId: string,
  campaignId: string,
  patch: { name?: string; segments?: string[]; scheduledAt?: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  const sets: string[] = ["updatedAt = :now"];
  const exprValues: Record<string, unknown> = { ":now": now };
  const exprNames: Record<string, string> = {};

  if (patch.name !== undefined) {
    sets.push("#name = :name");
    exprValues[":name"] = patch.name;
    exprNames["#name"] = "name";
  }
  if (patch.segments !== undefined) {
    sets.push("segments = :segments");
    exprValues[":segments"] = patch.segments;
  }
  if (patch.scheduledAt !== undefined) {
    if (patch.scheduledAt === null) {
      sets.push("REMOVE scheduledAt");
    } else {
      sets.push("scheduledAt = :scheduledAt");
      exprValues[":scheduledAt"] = patch.scheduledAt;
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeValues: exprValues,
      ...(Object.keys(exprNames).length > 0 ? { ExpressionAttributeNames: exprNames } : {}),
    })
  );
}

export async function incrementCampaignProgress(
  tenantId: string,
  campaignId: string,
  field: "sent" | "failed"
): Promise<Campaign | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: `ADD ${field} :one SET updatedAt = :now`,
      ExpressionAttributeValues: { ":one": 1, ":now": now },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Attributes as Campaign & {
    PK?: string;
    SK?: string;
    GSI1PK?: string;
    GSI1SK?: string;
  };
  const campaign = rest as Campaign;
  if (campaign.replyCount === undefined) campaign.replyCount = 0;

  if (
    campaign.sent + campaign.failed >= campaign.total &&
    campaign.status !== "completed"
  ) {
    const completedAt = now;
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
        UpdateExpression: "SET #status = :completed, updatedAt = :now, completedAt = :completedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":completed": "completed",
          ":now": now,
          ":completedAt": completedAt,
        },
      })
    );
    return { ...campaign, status: "completed", completedAt };
  }

  return campaign;
}

export async function incrementCampaignReplyCount(
  tenantId: string,
  campaignId: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: "ADD replyCount :one SET updatedAt = :now",
      ExpressionAttributeValues: { ":one": 1, ":now": now },
    })
  );
}

export async function saveCampaignPhoneLookup(
  tenantId: string,
  phone: string,
  campaignId: string,
  recipientSk: string
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + RECIPIENT_TTL_SECONDS;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...phoneLookupKeys(tenantId, phone, campaignId),
        tenantId,
        campaignId,
        recipientSk,
        ttl,
      },
    })
  );
}

export async function listCampaignLookupsForPhone(
  tenantId: string,
  phone: string
): Promise<Array<{ campaignId: string; recipientSk: string }>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#PHONE#${normalizePhone(phone)}`,
        ":sk": "CAMPLOOKUP#",
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    campaignId: item.campaignId as string,
    recipientSk: item.recipientSk as string,
  }));
}

export async function markRecipientReplied(
  tenantId: string,
  recipientSk: string,
  conversationId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TENANT#${tenantId}`, SK: recipientSk },
        UpdateExpression:
          "SET #status = :replied, repliedAt = :now, conversationId = :conversationId",
        ConditionExpression: "attribute_not_exists(repliedAt)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":replied": "replied",
          ":now": now,
          ":conversationId": conversationId,
        },
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

export async function recordCampaignReply(
  tenantId: string,
  phone: string,
  conversationId: string
): Promise<void> {
  const lookups = await listCampaignLookupsForPhone(tenantId, phone);
  await Promise.all(
    lookups.map(async ({ campaignId, recipientSk }) => {
      const recorded = await markRecipientReplied(tenantId, recipientSk, conversationId);
      if (recorded) {
        await incrementCampaignReplyCount(tenantId, campaignId);
      }
    })
  );
}

export interface CampaignRecipientRecord {
  recipientKey: string;
  to: string;
  status: string;
  repliedAt?: string;
  conversationId?: string;
}

export async function listCampaignRecipients(
  tenantId: string,
  campaignId: string,
  status?: "replied"
): Promise<CampaignRecipientRecord[]> {
  const items: CampaignRecipientRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": `CAMPREC#${campaignId}#`,
          ...(status === "replied" ? { ":replied": "replied" } : {}),
        },
        ...(status === "replied"
          ? {
              FilterExpression: "#status = :replied",
              ExpressionAttributeNames: { "#status": "status" },
            }
          : {}),
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      items.push({
        recipientKey: item.SK as string,
        to: item.to as string,
        status: item.status as string,
        ...(item.repliedAt ? { repliedAt: item.repliedAt as string } : {}),
        ...(item.conversationId ? { conversationId: item.conversationId as string } : {}),
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

export async function incrementCampaignAnalytics(
  tenantId: string,
  campaignId: string,
  field: "deliveredCount" | "readCount" | "deliveryFailed"
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: `ADD ${field} :one SET updatedAt = :now`,
      ExpressionAttributeValues: { ":one": 1, ":now": now },
    })
  );
}

export async function saveRecipients(
  tenantId: string,
  campaignId: string,
  recipients: CampaignRecipient[]
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + RECIPIENT_TTL_SECONDS;
  const BATCH_SIZE = 25;

  for (let start = 0; start < recipients.length; start += BATCH_SIZE) {
    const batch = recipients.slice(start, start + BATCH_SIZE);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch.map((r, i) => ({
            PutRequest: {
              Item: {
                ...recipientKeys(tenantId, campaignId, start + i),
                tenantId,
                campaignId,
                to: r.to,
                ...(r.components ? { components: r.components } : {}),
                status: "pending",
                ttl,
              },
            },
          })),
        },
      })
    );
  }
}

export interface PendingRecipient {
  to: string;
  components?: CampaignRecipient["components"];
  recipientKey: string;
}

export async function listPendingRecipients(
  tenantId: string,
  campaignId: string,
  limit = 100
): Promise<PendingRecipient[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      FilterExpression: "#status = :pending",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": `CAMPREC#${campaignId}#`,
        ":pending": "pending",
      },
      ExpressionAttributeNames: { "#status": "status" },
      ScanIndexForward: true,
      Limit: limit,
    })
  );

  return (result.Items ?? []).map((item) => {
    const r: PendingRecipient = {
      to: item.to as string,
      recipientKey: item.SK as string,
    };
    if (item.components) {
      r.components = item.components as CampaignRecipient["components"];
    }
    return r;
  });
}

export async function markRecipientSent(
  tenantId: string,
  sk: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: sk },
      UpdateExpression: "SET #status = :sent",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":sent": "sent" },
    })
  );
}

export async function saveCampaignMessageTracking(
  messageId: string,
  campaignId: string,
  tenantId: string,
  to: string,
  recipientKey?: string
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + RECIPIENT_TTL_SECONDS;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `MSGTRACK#${messageId}`,
        SK: `MSGTRACK#${messageId}`,
        campaignId,
        tenantId,
        to,
        kind: "campaign",
        ttl,
      },
    })
  );

  if (recipientKey) {
    await saveCampaignPhoneLookup(tenantId, to, campaignId, recipientKey);
  }
}

export async function getCampaignCount(tenantId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "CAMPAIGN#",
      },
      Select: "COUNT",
    })
  );
  return result.Count ?? 0;
}

export function makeCampaignId(): string {
  return randomUUID();
}
