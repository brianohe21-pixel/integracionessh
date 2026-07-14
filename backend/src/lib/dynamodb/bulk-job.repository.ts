import { randomUUID } from "crypto";
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  BulkSendFailure,
  BulkSendFailureKind,
  BulkSendFailureSummary,
  BulkSendFailuresResponse,
  BulkSendJob,
  BulkSendJobStatus,
  WhatsAppStatusError,
} from "../../types/index.js";

const keys = (tenantId: string, jobId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BULKJOB#${jobId}`,
});

const msgTrackingKeys = (messageId: string) => ({
  PK: `MSGTRACK#${messageId}`,
  SK: `MSGTRACK#${messageId}`,
});

const failureKeys = (tenantId: string, jobId: string, failedAt: string, failureId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BULKFAIL#${jobId}#${failedAt}#${failureId}`,
});

const FAILURE_TTL_SECONDS = 30 * 24 * 60 * 60;

function summaryKey(item: BulkSendFailure): string {
  return `${item.kind}:${item.errorCode ?? "na"}:${item.errorTitle ?? item.errorMessage}`;
}

function buildFailureSummary(items: BulkSendFailure[]): BulkSendFailureSummary[] {
  const counts = new Map<string, BulkSendFailureSummary>();
  for (const item of items) {
    const key = summaryKey(item);
    const existing = counts.get(key);
    const label = item.errorTitle ?? item.errorMessage;
    if (existing) {
      existing.count += 1;
    } else {
      const entry: BulkSendFailureSummary = {
        kind: item.kind,
        errorTitle: label,
        count: 1,
      };
      if (item.errorCode != null) entry.errorCode = item.errorCode;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function parseSendFailureError(error: unknown): Pick<BulkSendFailure, "errorCode" | "errorTitle" | "errorMessage"> {
  const fallback = error instanceof Error ? error.message : String(error);
  const apiPrefix = fallback.match(/^WhatsApp API error \d+: (.+)$/s);
  if (!apiPrefix) {
    return { errorMessage: fallback };
  }
  try {
    const parsed = JSON.parse(apiPrefix[1]) as {
      error?: { code?: number; message?: string; error_user_msg?: string };
    };
    const detail = parsed.error?.error_user_msg ?? parsed.error?.message ?? fallback;
    const result: Pick<BulkSendFailure, "errorCode" | "errorTitle" | "errorMessage"> = {
      errorMessage: detail,
      errorTitle: detail,
    };
    if (parsed.error?.code != null) result.errorCode = parsed.error.code;
    return result;
  } catch {
    return { errorMessage: fallback };
  }
}

export function parseDeliveryFailureError(
  errors?: WhatsAppStatusError[]
): Pick<BulkSendFailure, "errorCode" | "errorTitle" | "errorMessage"> {
  const first = errors?.[0];
  if (!first) {
    return { errorMessage: "Entrega fallida sin detalle de Meta" };
  }
  const detail = first.message ?? first.error_data?.details ?? first.title;
  const result: Pick<BulkSendFailure, "errorCode" | "errorTitle" | "errorMessage"> = {
    errorCode: first.code,
    errorTitle: first.title,
    errorMessage: detail,
  };
  return result;
}

export async function saveBulkSendFailure(
  failure: Omit<BulkSendFailure, "failedAt"> & { failedAt?: string }
): Promise<void> {
  const failedAt = failure.failedAt ?? new Date().toISOString();
  const failureId = randomUUID();
  const ttl = Math.floor(Date.now() / 1000) + FAILURE_TTL_SECONDS;
  const item: Record<string, unknown> = {
    ...failureKeys(failure.tenantId, failure.jobId, failedAt, failureId),
    tenantId: failure.tenantId,
    jobId: failure.jobId,
    kind: failure.kind,
    to: failure.to,
    errorMessage: failure.errorMessage,
    failedAt,
    ttl,
  };
  if (failure.messageId) item.messageId = failure.messageId;
  if (failure.errorCode != null) item.errorCode = failure.errorCode;
  if (failure.errorTitle) item.errorTitle = failure.errorTitle;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

export async function recordBulkSendFailure(
  tenantId: string,
  jobId: string,
  kind: BulkSendFailureKind,
  input: {
    to: string;
    messageId?: string;
    errorCode?: number;
    errorTitle?: string;
    errorMessage: string;
  }
): Promise<void> {
  const failure: Omit<BulkSendFailure, "failedAt"> = {
    tenantId,
    jobId,
    kind,
    to: input.to,
    errorMessage: input.errorMessage,
  };
  if (input.messageId) failure.messageId = input.messageId;
  if (input.errorCode != null) failure.errorCode = input.errorCode;
  if (input.errorTitle) failure.errorTitle = input.errorTitle;
  await saveBulkSendFailure(failure);
}

export async function listBulkSendFailures(
  tenantId: string,
  jobId: string,
  limit = 500
): Promise<BulkSendFailuresResponse> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": `BULKFAIL#${jobId}#`,
      },
      ScanIndexForward: false,
      Limit: Math.min(limit, 1000),
    })
  );

  const items = (result.Items ?? []).map(({ PK, SK, ttl: _ttl, ...rest }) => rest as BulkSendFailure);

  return {
    jobId,
    items,
    summary: buildFailureSummary(items),
    total: items.length,
  };
}

export async function saveMessageTracking(
  messageId: string,
  jobId: string,
  tenantId: string,
  to: string
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 72 * 60 * 60;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...msgTrackingKeys(messageId), jobId, tenantId, to, ttl },
    })
  );
}

export type MessageTracking = {
  tenantId: string;
  to?: string;
  kind?: string;
  campaignId?: string;
  jobId?: string;
};

export async function getMessageTracking(
  messageId: string
): Promise<MessageTracking | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: msgTrackingKeys(messageId) })
  );
  if (!result.Item) return null;

  const tracking: MessageTracking = {
    tenantId: result.Item.tenantId as string,
  };

  if (result.Item.to) tracking.to = result.Item.to as string;
  if (result.Item.kind) tracking.kind = result.Item.kind as string;
  if (result.Item.campaignId) tracking.campaignId = result.Item.campaignId as string;
  if (result.Item.jobId) tracking.jobId = result.Item.jobId as string;

  return tracking;
}

export async function deleteMessageTracking(messageId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: msgTrackingKeys(messageId) })
  );
}

export async function incrementBulkJobDeliveryFailed(
  tenantId: string,
  jobId: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, jobId),
      UpdateExpression: "ADD deliveryFailed :one SET updatedAt = :now",
      ExpressionAttributeValues: { ":one": 1, ":now": now },
    })
  );
}

export async function recordBulkDeliveryFailure(
  tenantId: string,
  jobId: string,
  input: {
    to: string;
    messageId?: string;
    errorCode?: number;
    errorTitle?: string;
    errorMessage: string;
  }
): Promise<void> {
  await Promise.all([
    incrementBulkJobDeliveryFailed(tenantId, jobId),
    recordBulkSendFailure(tenantId, jobId, "delivery", input),
  ]);
}

export async function createBulkJob(
  job: Omit<BulkSendJob, "sent" | "failed" | "deliveryFailed"> & { sent?: number; failed?: number; deliveryFailed?: number }
): Promise<BulkSendJob> {
  const record: BulkSendJob = {
    sent: 0,
    failed: 0,
    deliveryFailed: 0,
    ...job,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...keys(job.tenantId, job.jobId), ...record },
    })
  );

  return record;
}

export async function getBulkJob(
  tenantId: string,
  jobId: string
): Promise<BulkSendJob | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, jobId),
    })
  );

  if (!result.Item) return null;

  const { PK, SK, ...rest } = result.Item;
  return rest as BulkSendJob;
}

export async function updateBulkJobStatus(
  tenantId: string,
  jobId: string,
  status: BulkSendJobStatus
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, jobId),
      UpdateExpression: "SET #status = :status, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":now": now },
    })
  );
}

export async function listBulkJobs(
  tenantId: string,
  limit = 20
): Promise<BulkSendJob[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "BULKJOB#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items ?? []).map(({ PK, SK, ...rest }) => rest as BulkSendJob);
}

export async function incrementBulkJobProgress(
  tenantId: string,
  jobId: string,
  field: "sent" | "failed"
): Promise<BulkSendJob | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, jobId),
      UpdateExpression: `ADD ${field} :one SET updatedAt = :now`,
      ExpressionAttributeValues: { ":one": 1, ":now": now },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) return null;

  const job = result.Attributes as BulkSendJob & { PK?: string; SK?: string };
  const { PK, SK, ...rest } = job;

  if (rest.sent + rest.failed >= rest.total && rest.status !== "completed") {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: keys(tenantId, jobId),
        UpdateExpression: "SET #status = :completed, updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":completed": "completed", ":now": now },
      })
    );
    return { ...rest, status: "completed" };
  }

  return rest as BulkSendJob;
}
