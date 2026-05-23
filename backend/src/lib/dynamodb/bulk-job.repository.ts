import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { BulkSendJob, BulkSendJobStatus } from "../../types/index.js";

const keys = (tenantId: string, jobId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BULKJOB#${jobId}`,
});

const msgTrackingKeys = (messageId: string) => ({
  PK: `MSGTRACK#${messageId}`,
  SK: `MSGTRACK#${messageId}`,
});

export async function saveMessageTracking(
  messageId: string,
  jobId: string,
  tenantId: string
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 72 * 60 * 60;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...msgTrackingKeys(messageId), jobId, tenantId, ttl },
    })
  );
}

export async function getMessageTracking(
  messageId: string
): Promise<{ jobId: string; tenantId: string } | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: msgTrackingKeys(messageId) })
  );
  if (!result.Item) return null;
  return { jobId: result.Item.jobId as string, tenantId: result.Item.tenantId as string };
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
