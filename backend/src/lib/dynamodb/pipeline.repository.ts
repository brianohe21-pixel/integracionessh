import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { PipelineStage, SalesPipeline } from "../../types/index.js";

const pipelineKeys = (tenantId: string, pipelineId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `PIPELINE#${pipelineId}`,
});

function gsi1Keys(tenantId: string, isDefault: boolean, name: string, pipelineId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#PIPELINES`,
    GSI1SK: isDefault
      ? `DEFAULT#0#${pipelineId}`
      : `NAME#${name.toLowerCase()}#${pipelineId}`,
  };
}

function stripItem(item: Record<string, unknown>): SalesPipeline {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as SalesPipeline;
}

export async function getPipelineById(
  tenantId: string,
  pipelineId: string
): Promise<SalesPipeline | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: pipelineKeys(tenantId, pipelineId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listPipelines(tenantId: string): Promise<SalesPipeline[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#PIPELINES`,
      },
      ScanIndexForward: true,
    })
  );

  return (result.Items ?? [])
    .filter((item) => String(item.SK ?? "").startsWith("PIPELINE#"))
    .map(stripItem)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function getDefaultPipeline(tenantId: string): Promise<SalesPipeline | null> {
  const pipelines = await listPipelines(tenantId);
  return pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0] ?? null;
}

export async function createPipeline(pipeline: SalesPipeline): Promise<SalesPipeline> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...pipelineKeys(pipeline.tenantId, pipeline.pipelineId),
        ...gsi1Keys(pipeline.tenantId, pipeline.isDefault, pipeline.name, pipeline.pipelineId),
        ...pipeline,
      },
    })
  );
  return pipeline;
}

export async function updatePipeline(
  tenantId: string,
  pipelineId: string,
  updates: Partial<Pick<SalesPipeline, "name" | "isDefault" | "stages">>
): Promise<SalesPipeline | null> {
  const existing = await getPipelineById(tenantId, pipelineId);
  if (!existing) return null;

  const merged: SalesPipeline = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...pipelineKeys(tenantId, pipelineId),
        ...gsi1Keys(tenantId, merged.isDefault, merged.name, pipelineId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function deletePipeline(tenantId: string, pipelineId: string): Promise<boolean> {
  const existing = await getPipelineById(tenantId, pipelineId);
  if (!existing || existing.isDefault) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: pipelineKeys(tenantId, pipelineId),
    })
  );
  return true;
}

export function findStageById(
  pipeline: SalesPipeline,
  stageId: string
): PipelineStage | undefined {
  return pipeline.stages.find((stage) => stage.stageId === stageId);
}

export function sortStages(stages: PipelineStage[]): PipelineStage[] {
  return [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
}
