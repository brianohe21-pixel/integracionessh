import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type { OpportunityActivityEvent, OpportunityActivityType } from "../../types/index.js";

function keys(tenantId: string, opportunityId: string, activityId: string, createdAt: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `OPPACT#${opportunityId}#${activityId}`,
    GSI1PK: `TENANT#${tenantId}#OPP#${opportunityId}#ACTIVITY`,
    GSI1SK: `EVENT#${createdAt}#${activityId}`,
  };
}

function stripItem(item: Record<string, unknown>): OpportunityActivityEvent {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as OpportunityActivityEvent;
}

export interface ListActivityOptions {
  limit?: number;
  cursor?: string;
}

export interface ListActivityResult {
  items: OpportunityActivityEvent[];
  nextCursor?: string;
}

export async function appendOpportunityActivity(params: {
  tenantId: string;
  opportunityId: string;
  type: OpportunityActivityType;
  message?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}): Promise<OpportunityActivityEvent> {
  const activityId = randomUUID();
  const createdAt = new Date().toISOString();
  const event: OpportunityActivityEvent = {
    activityId,
    tenantId: params.tenantId,
    opportunityId: params.opportunityId,
    type: params.type,
    createdAt,
    ...(params.message ? { message: params.message } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys(params.tenantId, params.opportunityId, activityId, createdAt),
        ...event,
      },
    })
  );

  return event;
}

export async function listOpportunityActivities(
  tenantId: string,
  opportunityId: string,
  options: ListActivityOptions = {}
): Promise<ListActivityResult> {
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
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#OPP#${opportunityId}#ACTIVITY`,
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
