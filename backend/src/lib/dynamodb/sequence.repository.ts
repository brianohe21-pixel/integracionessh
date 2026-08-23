import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { SalesSequence } from "../../types/index.js";

const sequenceKeys = (tenantId: string, sequenceId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `SEQUENCE#${sequenceId}`,
});

function gsi1Keys(tenantId: string, enabled: boolean, sequenceId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#SEQUENCES`,
    GSI1SK: `ENABLED#${enabled ? 1 : 0}#${sequenceId}`,
  };
}

function stripItem(item: Record<string, unknown>): SalesSequence {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as SalesSequence;
}

export async function getSequenceById(
  tenantId: string,
  sequenceId: string
): Promise<SalesSequence | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: sequenceKeys(tenantId, sequenceId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listSequences(tenantId: string): Promise<SalesSequence[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#SEQUENCES`,
      },
      ScanIndexForward: false,
    })
  );

  return (result.Items ?? [])
    .filter((item) => String(item.SK ?? "").startsWith("SEQUENCE#"))
    .map(stripItem)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSequence(sequence: SalesSequence): Promise<SalesSequence> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...sequenceKeys(sequence.tenantId, sequence.sequenceId),
        ...gsi1Keys(sequence.tenantId, sequence.enabled, sequence.sequenceId),
        ...sequence,
      },
    })
  );
  return sequence;
}

export async function updateSequence(
  tenantId: string,
  sequenceId: string,
  updates: Partial<Pick<SalesSequence, "name" | "enabled" | "trigger" | "triggerStageId" | "pipelineId" | "steps">>
): Promise<SalesSequence | null> {
  const existing = await getSequenceById(tenantId, sequenceId);
  if (!existing) return null;

  const merged: SalesSequence = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...sequenceKeys(tenantId, sequenceId),
        ...gsi1Keys(tenantId, merged.enabled, sequenceId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function deleteSequence(tenantId: string, sequenceId: string): Promise<boolean> {
  const existing = await getSequenceById(tenantId, sequenceId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: sequenceKeys(tenantId, sequenceId),
    })
  );
  return true;
}
