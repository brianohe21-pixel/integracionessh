import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { FlowEventSubmission } from "../../types/index.js";

const submissionKeys = (tenantId: string, submissionId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `FLOWEVENT#${submissionId}`,
});

const idempotencyKeys = (tenantId: string, flowId: string, idempotencyKey: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `FLOWEVENTIDEM#${flowId}#${idempotencyKey}`,
});

const submissionGsi1 = (tenantId: string, flowId: string, createdAt: string, submissionId: string) => ({
  GSI1PK: `TENANT#${tenantId}#FLOW#${flowId}#EVENTS`,
  GSI1SK: `CREATED#${createdAt}#${submissionId}`,
});

export async function createFlowEventSubmission(
  submission: FlowEventSubmission
): Promise<FlowEventSubmission> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...submissionKeys(submission.tenantId, submission.submissionId),
        ...submissionGsi1(
          submission.tenantId,
          submission.flowId,
          submission.createdAt,
          submission.submissionId
        ),
        ...submission,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return submission;
}

export async function putFlowEventIdempotencyRecord(params: {
  tenantId: string;
  flowId: string;
  idempotencyKey: string;
  submissionId: string;
  createdAt: string;
}): Promise<boolean> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...idempotencyKeys(params.tenantId, params.flowId, params.idempotencyKey),
          submissionId: params.submissionId,
          createdAt: params.createdAt,
          ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getFlowEventIdempotencyRecord(
  tenantId: string,
  flowId: string,
  idempotencyKey: string
): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: idempotencyKeys(tenantId, flowId, idempotencyKey),
    })
  );
  return (result.Item?.submissionId as string | undefined) ?? null;
}

export async function getFlowEventSubmission(
  tenantId: string,
  submissionId: string
): Promise<FlowEventSubmission | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: submissionKeys(tenantId, submissionId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = result.Item;
  return rest as FlowEventSubmission;
}

export async function updateFlowEventSubmission(
  tenantId: string,
  submissionId: string,
  updates: Partial<FlowEventSubmission>
): Promise<FlowEventSubmission | null> {
  const existing = await getFlowEventSubmission(tenantId, submissionId);
  if (!existing) return null;
  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...submissionKeys(tenantId, submissionId),
        ...submissionGsi1(tenantId, merged.flowId, merged.createdAt, submissionId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function listFlowEventSubmissions(
  tenantId: string,
  flowId: string,
  limit = 50
): Promise<FlowEventSubmission[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#FLOW#${flowId}#EVENTS`,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items ?? []).map(
    ({ PK, SK, GSI1PK, GSI1SK, ttl, ...rest }) => rest as FlowEventSubmission
  );
}
