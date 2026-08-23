import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { SalesTask, SalesTaskStatus } from "../../types/index.js";

const taskKeys = (tenantId: string, taskId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `SALESTASK#${taskId}`,
});

function gsi1Keys(tenantId: string, status: SalesTaskStatus, dueAt: string, taskId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#TASKS`,
    GSI1SK: `STATUS#${status}#DUE#${dueAt}#TASK#${taskId}`,
  };
}

function stripItem(item: Record<string, unknown>): SalesTask {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as SalesTask;
}

export interface ListSalesTasksOptions {
  limit?: number;
  cursor?: string;
  status?: SalesTaskStatus;
  advisorId?: string;
}

export interface ListSalesTasksResult {
  items: SalesTask[];
  nextCursor?: string;
}

export async function getSalesTaskById(
  tenantId: string,
  taskId: string
): Promise<SalesTask | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: taskKeys(tenantId, taskId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listSalesTasks(
  tenantId: string,
  options: ListSalesTasksOptions = {}
): Promise<ListSalesTasksResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const items: SalesTask[] = [];
  let lastKey: Record<string, unknown> | undefined;

  if (options.cursor) {
    try {
      lastKey = JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      lastKey = undefined;
    }
  }

  const keyCondition = options.status
    ? "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :statusPrefix)"
    : "GSI1PK = :gsi1pk";

  const expressionValues: Record<string, string> = {
    ":gsi1pk": `TENANT#${tenantId}#TASKS`,
  };
  if (options.status) {
    expressionValues[":statusPrefix"] = `STATUS#${options.status}#`;
  }

  while (items.length < limit) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: expressionValues,
        ScanIndexForward: true,
        Limit: limit * 2,
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      if (!String(item.SK ?? "").startsWith("SALESTASK#")) continue;
      const task = stripItem(item);
      if (options.advisorId && task.advisorId !== options.advisorId) continue;
      items.push(task);
      if (items.length >= limit) break;
    }

    lastKey = result.LastEvaluatedKey;
    if (!lastKey || items.length >= limit) break;
  }

  const nextCursor =
    lastKey && items.length >= limit
      ? Buffer.from(JSON.stringify(lastKey)).toString("base64url")
      : undefined;

  return { items: items.slice(0, limit), ...(nextCursor ? { nextCursor } : {}) };
}

export async function createSalesTask(task: SalesTask): Promise<SalesTask> {
  const dueAt = task.dueAt ?? task.createdAt;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...taskKeys(task.tenantId, task.taskId),
        ...gsi1Keys(task.tenantId, task.status, dueAt, task.taskId),
        ...task,
      },
    })
  );
  return task;
}

export async function updateSalesTask(
  tenantId: string,
  taskId: string,
  updates: Partial<Pick<SalesTask, "title" | "description" | "dueAt" | "status" | "advisorId">>
): Promise<SalesTask | null> {
  const existing = await getSalesTaskById(tenantId, taskId);
  if (!existing) return null;

  const merged: SalesTask = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const dueAt = merged.dueAt ?? merged.updatedAt;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...taskKeys(tenantId, taskId),
        ...gsi1Keys(tenantId, merged.status, dueAt, taskId),
        ...merged,
      },
    })
  );
  return merged;
}
