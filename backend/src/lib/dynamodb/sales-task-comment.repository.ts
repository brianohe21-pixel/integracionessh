import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type { SalesTaskComment } from "../../types/index.js";

const commentKeys = (tenantId: string, taskId: string, commentId: string, createdAt: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `TASKCOMMENT#${taskId}#${createdAt}#${commentId}`,
});

const taskKeys = (tenantId: string, taskId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `SALESTASK#${taskId}`,
});

function stripItem(item: Record<string, unknown>): SalesTaskComment {
  const { PK, SK, ...rest } = item;
  void PK;
  void SK;
  return rest as unknown as SalesTaskComment;
}

export interface ListSalesTaskCommentsOptions {
  limit?: number;
  cursor?: string;
}

export interface ListSalesTaskCommentsResult {
  items: SalesTaskComment[];
  nextCursor?: string;
}

export async function createSalesTaskComment(params: {
  tenantId: string;
  taskId: string;
  body: string;
  authorId: string;
  authorName?: string;
}): Promise<SalesTaskComment> {
  const commentId = randomUUID();
  const createdAt = new Date().toISOString();
  const comment: SalesTaskComment = {
    commentId,
    taskId: params.taskId,
    tenantId: params.tenantId,
    body: params.body.trim(),
    authorId: params.authorId,
    createdAt,
    ...(params.authorName?.trim() ? { authorName: params.authorName.trim() } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...commentKeys(params.tenantId, params.taskId, commentId, createdAt),
        ...comment,
      },
    })
  );

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: taskKeys(params.tenantId, params.taskId),
      UpdateExpression: "SET commentCount = if_not_exists(commentCount, :zero) + :one, updatedAt = :now",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":one": 1,
        ":now": createdAt,
      },
    })
  );

  return comment;
}

export async function listSalesTaskComments(
  tenantId: string,
  taskId: string,
  options: ListSalesTaskCommentsOptions = {}
): Promise<ListSalesTaskCommentsResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
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

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":skPrefix": `TASKCOMMENT#${taskId}#`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    })
  );

  const items = (result.Items ?? []).map(stripItem);
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64url")
    : undefined;

  return { items, ...(nextCursor ? { nextCursor } : {}) };
}
