import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { FlowEdge, FlowNode } from "../../types/index.js";

export interface FlowVersionSnapshot {
  flowId: string;
  tenantId: string;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryNodeId: string;
  publishedAt: string;
}

function versionKeys(tenantId: string, flowId: string, version: number) {
  const padded = String(version).padStart(6, "0");
  return {
    PK: `TENANT#${tenantId}`,
    SK: `FLOWVERSION#${flowId}#${padded}`,
  };
}

function versionGsi1(tenantId: string, flowId: string, version: number) {
  const padded = String(version).padStart(6, "0");
  return {
    GSI1PK: `TENANT#${tenantId}#FLOW#${flowId}#VERSIONS`,
    GSI1SK: `VERSION#${padded}`,
  };
}

export async function createFlowVersionSnapshot(
  snapshot: FlowVersionSnapshot
): Promise<FlowVersionSnapshot> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...versionKeys(snapshot.tenantId, snapshot.flowId, snapshot.version),
        ...versionGsi1(snapshot.tenantId, snapshot.flowId, snapshot.version),
        ...snapshot,
      },
    })
  );
  return snapshot;
}

export async function listFlowVersionSnapshots(
  tenantId: string,
  flowId: string,
  limit = 20
): Promise<FlowVersionSnapshot[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#FLOW#${flowId}#VERSIONS`,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items ?? []).map(
    ({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as FlowVersionSnapshot
  );
}

export async function getFlowVersionSnapshot(
  tenantId: string,
  flowId: string,
  version: number
): Promise<FlowVersionSnapshot | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: versionKeys(tenantId, flowId, version),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as FlowVersionSnapshot;
}
