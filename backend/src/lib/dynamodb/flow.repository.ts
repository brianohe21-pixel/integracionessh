import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type { FlowDefinition, FlowRun, FlowRunStatus } from "../../types/index.js";

const definitionKeys = (tenantId: string, flowId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `FLOW#${flowId}`,
});

const definitionGsi1 = (tenantId: string, botId: string, enabled: boolean, name: string) => ({
  GSI1PK: `TENANT#${tenantId}#BOT#${botId}#FLOWS`,
  GSI1SK: `ENABLED#${enabled ? "1" : "0"}#${name}`,
});

const runKeys = (tenantId: string, runId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `FLOWRUN#${runId}`,
});

const runGsi1 = (tenantId: string, conversationId: string) => ({
  GSI1PK: `TENANT#${tenantId}#CONV#${conversationId}`,
  GSI1SK: `FLOWRUN#ACTIVE`,
});

export function makeFlowId(): string {
  return randomUUID();
}

export function makeFlowRunId(): string {
  return randomUUID();
}

export async function createFlowDefinition(
  flow: FlowDefinition
): Promise<FlowDefinition> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...definitionKeys(flow.tenantId, flow.flowId),
        ...definitionGsi1(flow.tenantId, flow.botId, flow.enabled, flow.name),
        ...flow,
      },
    })
  );
  return flow;
}

export async function updateFlowDefinition(
  tenantId: string,
  flowId: string,
  updates: Partial<FlowDefinition>
): Promise<FlowDefinition | null> {
  const existing = await getFlowDefinition(tenantId, flowId);
  if (!existing) return null;
  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...definitionKeys(tenantId, flowId),
        ...definitionGsi1(merged.tenantId, merged.botId, merged.enabled, merged.name),
        ...merged,
      },
    })
  );
  return merged;
}

export async function getFlowDefinition(
  tenantId: string,
  flowId: string
): Promise<FlowDefinition | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: definitionKeys(tenantId, flowId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as FlowDefinition;
}

export async function listFlowDefinitions(
  tenantId: string,
  botId?: string
): Promise<FlowDefinition[]> {
  if (botId) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}#BOT#${botId}#FLOWS`,
        },
      })
    );
    return (result.Items ?? []).map(
      ({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as FlowDefinition
    );
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "FLOW#",
      },
    })
  );
  return (result.Items ?? []).map(
    ({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as FlowDefinition
  );
}

export async function deleteFlowDefinition(
  tenantId: string,
  flowId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: definitionKeys(tenantId, flowId),
    })
  );
}

export async function countFlowsForBot(
  tenantId: string,
  botId: string
): Promise<number> {
  const flows = await listFlowDefinitions(tenantId, botId);
  return flows.length;
}

export async function listEnabledFlowsForBot(
  tenantId: string,
  botId: string
): Promise<FlowDefinition[]> {
  const flows = await listFlowDefinitions(tenantId, botId);
  return flows.filter((f) => f.enabled);
}

export async function createFlowRun(run: FlowRun): Promise<FlowRun> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...runKeys(run.tenantId, run.runId),
        ...runGsi1(run.tenantId, run.conversationId),
        ...run,
      },
    })
  );
  return run;
}

export async function updateFlowRun(
  tenantId: string,
  runId: string,
  updates: Partial<FlowRun>
): Promise<FlowRun | null> {
  const existing = await getFlowRun(tenantId, runId);
  if (!existing) return null;
  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  if (updates.status === "active" && updates.waitingUntil === undefined) {
    delete merged.waitingUntil;
  }
  const gsi1 =
    merged.status === "active" || merged.status === "waiting"
      ? runGsi1(merged.tenantId, merged.conversationId)
      : { GSI1PK: `TENANT#${merged.tenantId}#FLOWRUN#DONE`, GSI1SK: merged.runId };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...runKeys(tenantId, runId),
        ...gsi1,
        ...merged,
      },
    })
  );
  return merged;
}

export async function getFlowRun(
  tenantId: string,
  runId: string
): Promise<FlowRun | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: runKeys(tenantId, runId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as FlowRun;
}

export async function getActiveFlowRunForConversation(
  tenantId: string,
  conversationId: string
): Promise<FlowRun | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#CONV#${conversationId}`,
        ":sk": "FLOWRUN#ACTIVE",
      },
      Limit: 1,
    })
  );
  const item = result.Items?.[0];
  if (!item) return null;
  const run = item as FlowRun;
  if (run.status !== "active" && run.status !== "waiting") return null;
  return run;
}

export async function countActiveFlowRuns(tenantId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      FilterExpression: "#s IN (:active, :waiting)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "FLOWRUN#",
        ":active": "active",
        ":waiting": "waiting",
      },
    })
  );
  return result.Items?.length ?? 0;
}

export async function setFlowRunStatus(
  tenantId: string,
  runId: string,
  status: FlowRunStatus
): Promise<void> {
  await updateFlowRun(tenantId, runId, { status });
}
