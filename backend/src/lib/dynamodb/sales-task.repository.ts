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

const oppTaskKeys = (tenantId: string, opportunityId: string, taskId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `OPPTASK#${opportunityId}#${taskId}`,
});

const convTaskKeys = (tenantId: string, conversationId: string, taskId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `CONVTASK#${conversationId}#${taskId}`,
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

function matchesSearch(task: SalesTask, q?: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [task.title, task.description, task.contactName, task.contactEmail, task.contactPhone]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesDueRange(task: SalesTask, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!task.dueAt) return false;
  if (from && task.dueAt < from) return false;
  if (to && task.dueAt > to) return false;
  return true;
}

export type SalesTaskUpdateFields = Partial<
  Pick<
    SalesTask,
    | "title"
    | "description"
    | "status"
    | "advisorId"
    | "conversationId"
    | "botId"
    | "contactPhone"
    | "contactName"
    | "priority"
    | "reminderTargets"
    | "reminderUserIds"
    | "reminderChannels"
    | "reminderMinutesBefore"
  >
> & {
  dueAt?: string | null;
  leadId?: string | null;
  contactEmail?: string | null;
  reminderExternal?: SalesTask["reminderExternal"] | null;
  reminderScheduleName?: string | null;
  reminderSentAt?: string | null;
  reminderStatus?: SalesTask["reminderStatus"] | null;
};

export interface ListSalesTasksOptions {
  limit?: number;
  cursor?: string;
  status?: SalesTaskStatus;
  advisorId?: string;
  opportunityId?: string;
  conversationId?: string;
  from?: string;
  to?: string;
  q?: string;
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
  if (options.conversationId) {
    return listSalesTasksByConversation(tenantId, options.conversationId, options);
  }
  if (options.opportunityId) {
    return listSalesTasksByOpportunity(tenantId, options.opportunityId, options);
  }

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

  const expressionValues: Record<string, string> = {
    ":gsi1pk": `TENANT#${tenantId}#TASKS`,
  };

  let keyCondition = "GSI1PK = :gsi1pk";
  if (options.status && options.from && options.to) {
    keyCondition = "GSI1PK = :gsi1pk AND GSI1SK BETWEEN :fromSk AND :toSk";
    expressionValues[":fromSk"] = `STATUS#${options.status}#DUE#${options.from}`;
    expressionValues[":toSk"] = `STATUS#${options.status}#DUE#${options.to}~`;
  } else if (options.status) {
    keyCondition = "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :statusPrefix)";
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
      if (!matchesDueRange(task, options.from, options.to)) continue;
      if (!matchesSearch(task, options.q)) continue;
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

export async function listSalesTasksByOpportunity(
  tenantId: string,
  opportunityId: string,
  options: ListSalesTasksOptions = {}
): Promise<ListSalesTasksResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":skPrefix": `OPPTASK#${opportunityId}#`,
      },
      ScanIndexForward: false,
      Limit: limit * 2,
    })
  );

  const taskIds = (result.Items ?? []).map((item) => String(item.taskId ?? ""));
  const tasks: SalesTask[] = [];
  for (const taskId of taskIds) {
    const task = await getSalesTaskById(tenantId, taskId);
    if (!task) continue;
    if (options.status && task.status !== options.status) continue;
    if (options.advisorId && task.advisorId !== options.advisorId) continue;
    if (!matchesDueRange(task, options.from, options.to)) continue;
    if (!matchesSearch(task, options.q)) continue;
    tasks.push(task);
    if (tasks.length >= limit) break;
  }

  return { items: tasks.slice(0, limit) };
}

export async function listSalesTasksByConversation(
  tenantId: string,
  conversationId: string,
  options: ListSalesTasksOptions = {}
): Promise<ListSalesTasksResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":skPrefix": `CONVTASK#${conversationId}#`,
      },
      ScanIndexForward: false,
      Limit: limit * 2,
    })
  );

  const taskIds = (result.Items ?? []).map((item) => String(item.taskId ?? ""));
  const tasks: SalesTask[] = [];
  for (const taskId of taskIds) {
    const task = await getSalesTaskById(tenantId, taskId);
    if (!task) continue;
    if (options.status && task.status !== options.status) continue;
    if (options.advisorId && task.advisorId !== options.advisorId) continue;
    if (!matchesDueRange(task, options.from, options.to)) continue;
    if (!matchesSearch(task, options.q)) continue;
    tasks.push(task);
    if (tasks.length >= limit) break;
  }

  return { items: tasks.slice(0, limit) };
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

  if (task.opportunityId) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...oppTaskKeys(task.tenantId, task.opportunityId, task.taskId),
          tenantId: task.tenantId,
          opportunityId: task.opportunityId,
          taskId: task.taskId,
          createdAt: task.createdAt,
        },
      })
    );
  }

  if (task.conversationId) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...convTaskKeys(task.tenantId, task.conversationId, task.taskId),
          tenantId: task.tenantId,
          conversationId: task.conversationId,
          taskId: task.taskId,
          createdAt: task.createdAt,
        },
      })
    );
  }

  return task;
}

export async function updateSalesTask(
  tenantId: string,
  taskId: string,
  updates: SalesTaskUpdateFields
): Promise<SalesTask | null> {
  const existing = await getSalesTaskById(tenantId, taskId);
  if (!existing) return null;

  const merged: SalesTask = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };

  if (updates.title !== undefined) merged.title = updates.title;
  if (updates.description !== undefined) merged.description = updates.description;
  if (updates.status !== undefined) merged.status = updates.status;
  if (updates.advisorId !== undefined) merged.advisorId = updates.advisorId;
  if (updates.conversationId !== undefined) merged.conversationId = updates.conversationId;
  if (updates.botId !== undefined) merged.botId = updates.botId;
  if (updates.contactPhone !== undefined) merged.contactPhone = updates.contactPhone;
  if (updates.contactName !== undefined) merged.contactName = updates.contactName;
  if (updates.priority !== undefined) merged.priority = updates.priority;
  if (updates.reminderTargets !== undefined) merged.reminderTargets = updates.reminderTargets;
  if (updates.reminderUserIds !== undefined) {
    if (updates.reminderUserIds.length === 0) {
      delete merged.reminderUserIds;
    } else {
      merged.reminderUserIds = updates.reminderUserIds;
    }
  }
  if (updates.reminderExternal !== undefined) {
    if (updates.reminderExternal === null) {
      delete merged.reminderExternal;
    } else {
      merged.reminderExternal = updates.reminderExternal;
    }
  }
  if (updates.reminderChannels !== undefined) merged.reminderChannels = updates.reminderChannels;
  if (updates.reminderMinutesBefore !== undefined) {
    merged.reminderMinutesBefore = updates.reminderMinutesBefore;
  }
  if (updates.leadId === null) {
    delete merged.leadId;
  } else if (updates.leadId !== undefined) {
    merged.leadId = updates.leadId;
  }
  if (updates.reminderStatus !== undefined) {
    if (updates.reminderStatus === null) {
      delete merged.reminderStatus;
    } else {
      merged.reminderStatus = updates.reminderStatus;
    }
  }
  if (updates.reminderSentAt === null) {
    delete merged.reminderSentAt;
  } else if (updates.reminderSentAt !== undefined) {
    merged.reminderSentAt = updates.reminderSentAt;
  }

  if (updates.dueAt === null) {
    delete merged.dueAt;
  } else if (updates.dueAt !== undefined) {
    merged.dueAt = updates.dueAt;
  }

  if (updates.contactEmail === null) {
    delete merged.contactEmail;
  } else if (updates.contactEmail !== undefined) {
    merged.contactEmail = updates.contactEmail;
  }

  if (updates.reminderScheduleName === null) {
    delete merged.reminderScheduleName;
  } else if (updates.reminderScheduleName !== undefined) {
    merged.reminderScheduleName = updates.reminderScheduleName;
  }

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

  if (merged.conversationId && merged.conversationId !== existing.conversationId) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...convTaskKeys(tenantId, merged.conversationId, taskId),
          tenantId,
          conversationId: merged.conversationId,
          taskId,
          createdAt: merged.createdAt,
        },
      })
    );
  }

  return merged;
}
