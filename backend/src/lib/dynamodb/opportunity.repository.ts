import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  Opportunity,
  OpportunityStage,
  OpportunityStageHistoryEntry,
} from "../../types/index.js";

const opportunityKeys = (tenantId: string, opportunityId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `OPPORTUNITY#${opportunityId}`,
});

const historyKeys = (tenantId: string, opportunityId: string, historyId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `OPPHIST#${opportunityId}#${historyId}`,
});

function gsi1Keys(
  tenantId: string,
  pipelineId: string,
  stageId: string,
  updatedAt: string,
  opportunityId: string
) {
  return {
    GSI1PK: `TENANT#${tenantId}#PIPELINE#${pipelineId}`,
    GSI1SK: `STAGE#${stageId}#UPDATED#${updatedAt}#OPP#${opportunityId}`,
  };
}

function stripOpportunity(item: Record<string, unknown>): Opportunity {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as Opportunity;
}

function stripHistory(item: Record<string, unknown>): OpportunityStageHistoryEntry {
  const { PK, SK, ...rest } = item;
  void PK;
  void SK;
  return rest as unknown as OpportunityStageHistoryEntry;
}

export interface ListOpportunitiesOptions {
  limit?: number;
  cursor?: string;
  pipelineId?: string;
  stageId?: string;
  q?: string;
}

export interface ListOpportunitiesResult {
  items: Opportunity[];
  nextCursor?: string;
}

function matchesFilters(opportunity: Opportunity, options: ListOpportunitiesOptions): boolean {
  if (options.q) {
    const q = options.q.toLowerCase();
    const inTitle = opportunity.title.toLowerCase().includes(q);
    const inPhone = (opportunity.phone ?? "").includes(q);
    const inName = (opportunity.name ?? "").toLowerCase().includes(q);
    const inEmail = (opportunity.email ?? "").toLowerCase().includes(q);
    if (!inTitle && !inPhone && !inName && !inEmail) return false;
  }
  return true;
}

export async function getOpportunityById(
  tenantId: string,
  opportunityId: string
): Promise<Opportunity | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: opportunityKeys(tenantId, opportunityId),
    })
  );
  if (!result.Item) return null;
  return stripOpportunity(result.Item);
}

export async function listOpportunities(
  tenantId: string,
  options: ListOpportunitiesOptions = {}
): Promise<ListOpportunitiesResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const items: Opportunity[] = [];
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

  const gsi1pk = options.pipelineId
    ? `TENANT#${tenantId}#PIPELINE#${options.pipelineId}`
    : null;

  while (items.length < limit) {
    if (gsi1pk) {
      const keyCondition = options.stageId
        ? "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :stagePrefix)"
        : "GSI1PK = :gsi1pk";

      const expressionValues: Record<string, string> = {
        ":gsi1pk": gsi1pk,
      };
      if (options.stageId) {
        expressionValues[":stagePrefix"] = `STAGE#${options.stageId}#`;
      }

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: keyCondition,
          ExpressionAttributeValues: expressionValues,
          ScanIndexForward: false,
          Limit: limit * 3,
          ExclusiveStartKey: lastKey,
        })
      );

      for (const item of result.Items ?? []) {
        if (!String(item.SK ?? "").startsWith("OPPORTUNITY#")) continue;
        const opportunity = stripOpportunity(item);
        if (matchesFilters(opportunity, options)) {
          items.push(opportunity);
          if (items.length >= limit) break;
        }
      }

      lastKey = result.LastEvaluatedKey;
      if (!lastKey || items.length >= limit) break;
      continue;
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":skPrefix": "OPPORTUNITY#",
        },
        ScanIndexForward: false,
        Limit: limit * 3,
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const opportunity = stripOpportunity(item);
      if (matchesFilters(opportunity, options)) {
        items.push(opportunity);
        if (items.length >= limit) break;
      }
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

export async function listAllOpportunities(
  tenantId: string,
  pipelineId?: string
): Promise<Opportunity[]> {
  const all: Opportunity[] = [];
  let cursor: string | undefined;
  do {
    const page = await listOpportunities(tenantId, {
      limit: 100,
      ...(pipelineId ? { pipelineId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

export async function createOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...opportunityKeys(opportunity.tenantId, opportunity.opportunityId),
        ...gsi1Keys(
          opportunity.tenantId,
          opportunity.pipelineId,
          opportunity.stageId,
          opportunity.updatedAt,
          opportunity.opportunityId
        ),
        ...opportunity,
      },
    })
  );
  return opportunity;
}

export type OpportunityUpdateInput = Partial<
  Pick<
    Opportunity,
    | "title"
    | "amount"
    | "currency"
    | "phone"
    | "name"
    | "email"
    | "description"
    | "tags"
    | "leadId"
    | "conversationId"
    | "assignedAdvisorId"
    | "quotationId"
    | "paymentId"
    | "closedAt"
    | "closeReason"
    | "stage"
    | "stageId"
    | "pipelineId"
    | "botId"
  >
>;

export async function updateOpportunity(
  tenantId: string,
  opportunityId: string,
  updates: OpportunityUpdateInput
): Promise<Opportunity | null> {
  const existing = await getOpportunityById(tenantId, opportunityId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged: Opportunity = { ...existing, ...updates, updatedAt: now };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...opportunityKeys(tenantId, opportunityId),
        ...gsi1Keys(
          tenantId,
          merged.pipelineId,
          merged.stageId,
          merged.updatedAt,
          opportunityId
        ),
        ...merged,
      },
    })
  );
  return merged;
}

export async function deleteOpportunity(
  tenantId: string,
  opportunityId: string
): Promise<boolean> {
  const existing = await getOpportunityById(tenantId, opportunityId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: opportunityKeys(tenantId, opportunityId),
    })
  );
  return true;
}

export async function appendStageHistory(
  entry: OpportunityStageHistoryEntry
): Promise<OpportunityStageHistoryEntry> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...historyKeys(entry.tenantId, entry.opportunityId, entry.historyId),
        ...entry,
      },
    })
  );
  return entry;
}

export async function listStageHistory(
  tenantId: string,
  opportunityId: string
): Promise<OpportunityStageHistoryEntry[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":skPrefix": `OPPHIST#${opportunityId}#`,
      },
      ScanIndexForward: false,
    })
  );

  return (result.Items ?? []).map(stripHistory);
}

export function isClosedStage(stage: OpportunityStage): boolean {
  return stage === "won" || stage === "lost";
}
