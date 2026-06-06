import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { FlowResponse, MetaFlow, MetaFlowStatus } from "../../types/index.js";

const flowKeys = (tenantId: string, botId: string, metaFlowId: string) => ({
  PK: `TENANT#${tenantId}#BOT#${botId}`,
  SK: `METAFLOW#${metaFlowId}`,
});

const gsi1Keys = (tenantId: string, status: string, name: string) => ({
  GSI1PK: `TENANT#${tenantId}#METAFLOW`,
  GSI1SK: `STATUS#${status}#${name}`,
});

export async function listMetaFlows(
  tenantId: string,
  botId: string
): Promise<MetaFlow[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": "METAFLOW#",
      },
    })
  );
  return (result.Items ?? []).map(
    ({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as MetaFlow
  );
}

export async function getMetaFlow(
  tenantId: string,
  botId: string,
  metaFlowId: string
): Promise<MetaFlow | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: flowKeys(tenantId, botId, metaFlowId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as MetaFlow;
}

export async function upsertMetaFlow(flow: MetaFlow): Promise<MetaFlow> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...flowKeys(flow.tenantId, flow.botId, flow.metaFlowId),
        ...gsi1Keys(flow.tenantId, flow.status, flow.name),
        ...flow,
      },
    })
  );
  return flow;
}

export async function deleteMetaFlow(
  tenantId: string,
  botId: string,
  metaFlowId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: flowKeys(tenantId, botId, metaFlowId),
    })
  );
}

export async function countMetaFlowsForBot(
  tenantId: string,
  botId: string
): Promise<number> {
  const flows = await listMetaFlows(tenantId, botId);
  return flows.length;
}

const responseKeys = (
  tenantId: string,
  metaFlowId: string,
  createdAt: string,
  responseId: string
) => ({
  PK: `TENANT#${tenantId}`,
  SK: `FLOWRESP#${metaFlowId}#${createdAt}#${responseId}`,
});

export async function createFlowResponse(
  response: FlowResponse
): Promise<FlowResponse> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...responseKeys(
          response.tenantId,
          response.metaFlowId,
          response.createdAt,
          response.responseId
        ),
        GSI1PK: `TENANT#${response.tenantId}#FLOWRESP`,
        GSI1SK: `PHONE#${response.phone}#${response.createdAt}`,
        ...response,
      },
    })
  );
  return response;
}

export async function listFlowResponses(
  tenantId: string,
  botId?: string,
  limit = 50
): Promise<FlowResponse[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#FLOWRESP`,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  let items = (result.Items ?? []).map(
    ({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as FlowResponse
  );
  if (botId) {
    items = items.filter((r) => r.botId === botId);
  }
  return items;
}

export function mapMetaStatusToLocal(status: string): MetaFlowStatus {
  const upper = status.toUpperCase();
  if (upper === "PUBLISHED") return "PUBLISHED";
  if (upper === "DEPRECATED") return "DEPRECATED";
  return "DRAFT";
}
