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

function mapCampaignItem(item: Record<string, unknown>): Campaign {
  const { PK: _pk, SK: _sk, GSI1PK: _gsi1pk, GSI1SK: _gsi1sk, ...rest } = item;
  const campaign = rest as unknown as Campaign;
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

  return (result.Items ?? [])
    .map((item) => mapCampaignItem(item as Record<string, unknown>))
    .filter((campaign) => !campaign.archivedAt);
}

export async function listAllCampaigns(tenantId: string): Promise<Campaign[]> {
  const items: Campaign[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": "CAMPAIGN#",
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const campaign = mapCampaignItem(item as Record<string, unknown>);
      if (!campaign.archivedAt) items.push(campaign);
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
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
  patch: {
    name?: string;
    botId?: string;
    channel?: Campaign["channel"];
    templateName?: string;
    language?: string;
    segments?: string[];
    scheduledAt?: string | null;
    batchConfig?: Campaign["batchConfig"] | null;
    requireOptIn?: boolean;
    requestDlr?: boolean;
    total?: number;
    status?: Extract<CampaignStatus, "draft" | "scheduled">;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const sets: string[] = ["#updatedAt = :now"];
  const removes: string[] = [];
  const exprValues: Record<string, unknown> = { ":now": now };
  const exprNames: Record<string, string> = { "#updatedAt": "updatedAt" };

  const setField = (attr: string, valueKey: string, value: unknown) => {
    const nameKey = `#${attr}`;
    sets.push(`${nameKey} = ${valueKey}`);
    exprNames[nameKey] = attr;
    exprValues[valueKey] = value;
  };

  if (patch.name !== undefined) {
    setField("name", ":name", patch.name);
  }
  if (patch.botId !== undefined) {
    setField("botId", ":botId", patch.botId);
  }
  if (patch.channel !== undefined) {
    setField("channel", ":channel", patch.channel);
  }
  if (patch.templateName !== undefined) {
    setField("templateName", ":templateName", patch.templateName);
  }
  if (patch.language !== undefined) {
    setField("language", ":language", patch.language);
  }
  if (patch.segments !== undefined) {
    setField("segments", ":segments", patch.segments);
  }
  if (patch.scheduledAt !== undefined) {
    if (patch.scheduledAt === null) {
      removes.push("scheduledAt");
    } else {
      setField("scheduledAt", ":scheduledAt", patch.scheduledAt);
    }
  }
  if (patch.batchConfig !== undefined) {
    if (patch.batchConfig === null) {
      removes.push("batchConfig");
    } else {
      setField("batchConfig", ":batchConfig", patch.batchConfig);
    }
  }
  if (patch.requireOptIn !== undefined) {
    setField("requireOptIn", ":requireOptIn", patch.requireOptIn);
  }
  if (patch.requestDlr !== undefined) {
    if (patch.requestDlr) {
      setField("requestDlr", ":requestDlr", true);
    } else {
      removes.push("requestDlr");
    }
  }
  if (patch.total !== undefined) {
    setField("total", ":total", patch.total);
  }
  if (patch.status !== undefined) {
    setField("status", ":status", patch.status);
  }

  const updateExpression = [
    `SET ${sets.join(", ")}`,
    ...(removes.length > 0 ? [`REMOVE ${removes.join(", ")}`] : []),
  ].join(" ");

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

export async function incrementCampaignBatchVersion(
  tenantId: string,
  campaignId: string
): Promise<number> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression:
        "SET batchVersion = if_not_exists(batchVersion, :zero) + :one, updatedAt = :now REMOVE nextBatchAt",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":one": 1,
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes?.batchVersion as number) ?? 1;
}

export async function initializeCampaignBatchState(
  tenantId: string,
  campaignId: string
): Promise<number> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression:
        "SET batchVersion = :version, currentBatch = :zero, batchesDispatched = :zero, updatedAt = :now REMOVE nextBatchAt",
      ExpressionAttributeValues: {
        ":version": 1,
        ":zero": 0,
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes?.batchVersion as number) ?? 1;
}

export async function updateCampaignBatchDispatch(
  tenantId: string,
  campaignId: string,
  patch: {
    currentBatch: number;
    batchesDispatched: number;
    nextBatchAt?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const sets = [
    "currentBatch = :currentBatch",
    "batchesDispatched = :batchesDispatched",
    "updatedAt = :now",
  ];
  const exprValues: Record<string, unknown> = {
    ":currentBatch": patch.currentBatch,
    ":batchesDispatched": patch.batchesDispatched,
    ":now": now,
  };

  let updateExpression = `SET ${sets.join(", ")}`;
  if (patch.nextBatchAt === null) {
    updateExpression += " REMOVE nextBatchAt";
  } else if (patch.nextBatchAt) {
    updateExpression += ", nextBatchAt = :nextBatchAt";
    exprValues[":nextBatchAt"] = patch.nextBatchAt;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: exprValues,
    })
  );
}

export async function setCampaignNextBatchAt(
  tenantId: string,
  campaignId: string,
  nextBatchAt: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: "SET nextBatchAt = :nextBatchAt, updatedAt = :now",
      ExpressionAttributeValues: {
        ":nextBatchAt": nextBatchAt,
        ":now": now,
      },
    })
  );
}

export async function clearCampaignNextBatchAt(
  tenantId: string,
  campaignId: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: "SET updatedAt = :now REMOVE nextBatchAt",
      ExpressionAttributeValues: { ":now": now },
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
  const pending: PendingRecipient[] = [];
  let lastKey: Record<string, unknown> | undefined;

  while (pending.length < limit) {
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
        Limit: Math.max(limit - pending.length, 25),
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const recipient: PendingRecipient = {
        to: item.to as string,
        recipientKey: item.SK as string,
      };
      if (item.components) {
        recipient.components = item.components as CampaignRecipient["components"];
      }
      pending.push(recipient);
      if (pending.length >= limit) break;
    }

    lastKey = result.LastEvaluatedKey;
    if (!lastKey) break;
  }

  return pending.slice(0, limit);
}

export async function markRecipientSent(
  tenantId: string,
  sk: string
): Promise<boolean> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TENANT#${tenantId}`, SK: sk },
        UpdateExpression: "SET #status = :sent",
        ConditionExpression: "#status IN (:pending, :failed)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":sent": "sent",
          ":pending": "pending",
          ":failed": "failed",
        },
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

export async function markRecipientFailed(
  tenantId: string,
  sk: string
): Promise<boolean> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TENANT#${tenantId}`, SK: sk },
        UpdateExpression: "SET #status = :failed",
        ConditionExpression: "#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":failed": "failed",
          ":pending": "pending",
        },
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

export interface CampaignRecipientDetail {
  to: string;
  components?: CampaignRecipient["components"];
}

export async function listCampaignRecipientDetails(
  tenantId: string,
  campaignId: string
): Promise<CampaignRecipientDetail[]> {
  const recipients: CampaignRecipientDetail[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": `CAMPREC#${campaignId}#`,
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      recipients.push({
        to: item.to as string,
        ...(item.components
          ? { components: item.components as CampaignRecipient["components"] }
          : {}),
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return recipients;
}

async function listRecipientKeys(
  tenantId: string,
  campaignId: string
): Promise<string[]> {
  const keys: string[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": `CAMPREC#${campaignId}#`,
        },
        ProjectionExpression: "PK, SK",
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      keys.push(item.SK as string);
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return keys;
}

export async function deleteCampaignRecipients(
  tenantId: string,
  campaignId: string
): Promise<void> {
  const keys = await listRecipientKeys(tenantId, campaignId);
  const BATCH_SIZE = 25;

  for (let start = 0; start < keys.length; start += BATCH_SIZE) {
    const batch = keys.slice(start, start + BATCH_SIZE);
    if (batch.length === 0) continue;

    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch.map((sk) => ({
            DeleteRequest: {
              Key: {
                PK: `TENANT#${tenantId}`,
                SK: sk,
              },
            },
          })),
        },
      })
    );
  }
}

export async function replaceCampaignRecipients(
  tenantId: string,
  campaignId: string,
  recipients: CampaignRecipient[]
): Promise<void> {
  await deleteCampaignRecipients(tenantId, campaignId);
  if (recipients.length > 0) {
    await saveRecipients(tenantId, campaignId, recipients);
  }
}

export async function listFailedRecipients(
  tenantId: string,
  campaignId: string,
  limit = 5000
): Promise<PendingRecipient[]> {
  const failed: PendingRecipient[] = [];
  let lastKey: Record<string, unknown> | undefined;

  while (failed.length < limit) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "#status = :failed",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": `CAMPREC#${campaignId}#`,
          ":failed": "failed",
        },
        ExpressionAttributeNames: { "#status": "status" },
        ScanIndexForward: true,
        Limit: Math.max(limit - failed.length, 25),
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const recipient: PendingRecipient = {
        to: item.to as string,
        recipientKey: item.SK as string,
      };
      if (item.components) {
        recipient.components = item.components as CampaignRecipient["components"];
      }
      failed.push(recipient);
      if (failed.length >= limit) break;
    }

    lastKey = result.LastEvaluatedKey;
    if (!lastKey) break;
  }

  return failed.slice(0, limit);
}

export async function resetRecipientsForRetry(
  tenantId: string,
  recipientKeys: string[]
): Promise<number> {
  let resetCount = 0;

  for (const sk of recipientKeys) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `TENANT#${tenantId}`, SK: sk },
          UpdateExpression: "SET #status = :pending",
          ConditionExpression: "#status = :failed",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":pending": "pending",
            ":failed": "failed",
          },
        })
      );
      resetCount += 1;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) continue;
      throw error;
    }
  }

  return resetCount;
}

export async function adjustCampaignFailedCount(
  tenantId: string,
  campaignId: string,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: "ADD failed :delta SET updatedAt = :now",
      ExpressionAttributeValues: { ":delta": delta, ":now": now },
    })
  );
}

export async function reopenCampaignForRetry(
  tenantId: string,
  campaignId: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: "SET #status = :running, updatedAt = :now REMOVE completedAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":running": "running",
        ":now": now,
      },
    })
  );
}

export async function archiveCampaign(
  tenantId: string,
  campaignId: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `CAMPAIGN#${campaignId}` },
      UpdateExpression: "SET archivedAt = :archivedAt, updatedAt = :now",
      ExpressionAttributeValues: {
        ":archivedAt": now,
        ":now": now,
      },
    })
  );
}

export async function saveCampaignMessageTracking(
  messageId: string,
  campaignId: string,
  tenantId: string,
  to: string,
  recipientKey?: string,
  attemptId?: string
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
        ...(recipientKey ? { recipientKey } : {}),
        ...(attemptId ? { attemptId } : {}),
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
