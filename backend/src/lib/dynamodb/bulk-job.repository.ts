import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { BulkSendJob, BulkSendJobStatus } from "../../types/index.js";

const keys = (tenantId: string, jobId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BULKJOB#${jobId}`,
});

export async function createBulkJob(
  job: Omit<BulkSendJob, "sent" | "failed"> & { sent?: number; failed?: number }
): Promise<BulkSendJob> {
  const record: BulkSendJob = {
    sent: 0,
    failed: 0,
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
