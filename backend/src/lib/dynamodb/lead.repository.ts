import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { normalizePhone } from "./contact.repository.js";
import type { Lead, LeadStatus } from "../../types/index.js";

const leadKeys = (tenantId: string, leadId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `LEAD#${leadId}`,
});

const activeLeadPointerKeys = (tenantId: string, phone: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `LEADACTIVE#${phone}`,
});

const flowResponseLeadKeys = (tenantId: string, flowResponseId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `LEADRESP#${flowResponseId}`,
});

function gsi1Keys(tenantId: string, status: LeadStatus, createdAt: string, leadId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#LEADS`,
    GSI1SK: `STATUS#${status}#${createdAt}#${leadId}`,
  };
}

const ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "qualified"];

function stripItem(item: Record<string, unknown>): Lead {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as Lead;
}

export interface ListLeadsOptions {
  limit?: number;
  cursor?: string;
  status?: LeadStatus;
  botId?: string;
  metaFlowId?: string;
  q?: string;
}

export interface ListLeadsResult {
  items: Lead[];
  nextCursor?: string;
}

function matchesFilters(lead: Lead, options: ListLeadsOptions): boolean {
  if (options.botId && lead.botId !== options.botId) return false;
  if (options.metaFlowId && lead.metaFlowId !== options.metaFlowId) return false;
  if (options.q) {
    const q = options.q.toLowerCase();
    const inPhone = lead.phone.includes(q);
    const inName = (lead.name ?? "").toLowerCase().includes(q);
    const inEmail = (lead.email ?? "").toLowerCase().includes(q);
    if (!inPhone && !inName && !inEmail) return false;
  }
  return true;
}

export async function getLeadById(
  tenantId: string,
  leadId: string
): Promise<Lead | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: leadKeys(tenantId, leadId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function getLeadByFlowResponseId(
  tenantId: string,
  flowResponseId: string
): Promise<Lead | null> {
  const pointer = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: flowResponseLeadKeys(tenantId, flowResponseId),
    })
  );
  if (!pointer.Item?.leadId) return null;
  return getLeadById(tenantId, pointer.Item.leadId as string);
}

export async function getActiveLeadByPhone(
  tenantId: string,
  phone: string
): Promise<Lead | null> {
  const normalized = normalizePhone(phone);
  const pointer = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: activeLeadPointerKeys(tenantId, normalized),
    })
  );
  if (!pointer.Item?.leadId) return null;
  const lead = await getLeadById(tenantId, pointer.Item.leadId as string);
  if (!lead || !ACTIVE_STATUSES.includes(lead.status)) return null;
  return lead;
}

export async function listLeads(
  tenantId: string,
  options: ListLeadsOptions = {}
): Promise<ListLeadsResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const items: Lead[] = [];
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

  const gsi1pk = options.status
    ? `TENANT#${tenantId}#LEADS`
    : `TENANT#${tenantId}#LEADS`;

  while (items.length < limit) {
    const keyCondition = options.status
      ? "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :statusPrefix)"
      : "GSI1PK = :gsi1pk";

    const expressionValues: Record<string, string> = {
      ":gsi1pk": gsi1pk,
    };
    if (options.status) {
      expressionValues[":statusPrefix"] = `STATUS#${options.status}#`;
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
      if (!String(item.SK ?? "").startsWith("LEAD#")) continue;
      const lead = stripItem(item);
      if (matchesFilters(lead, options)) {
        items.push(lead);
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

export async function listAllLeads(tenantId: string): Promise<Lead[]> {
  const all: Lead[] = [];
  let cursor: string | undefined;
  do {
    const page = await listLeads(tenantId, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

async function setActiveLeadPointer(
  tenantId: string,
  phone: string,
  leadId: string
): Promise<void> {
  const normalized = normalizePhone(phone);
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...activeLeadPointerKeys(tenantId, normalized),
        leadId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

async function clearActiveLeadPointer(tenantId: string, phone: string): Promise<void> {
  const normalized = normalizePhone(phone);
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: activeLeadPointerKeys(tenantId, normalized),
    })
  );
}

async function setFlowResponseLeadPointer(
  tenantId: string,
  flowResponseId: string,
  leadId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...flowResponseLeadKeys(tenantId, flowResponseId),
        leadId,
      },
    })
  );
}

export async function createLead(lead: Lead): Promise<Lead> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...leadKeys(lead.tenantId, lead.leadId),
        ...gsi1Keys(lead.tenantId, lead.status, lead.createdAt, lead.leadId),
        ...lead,
      },
    })
  );
  if (ACTIVE_STATUSES.includes(lead.status)) {
    await setActiveLeadPointer(lead.tenantId, lead.phone, lead.leadId);
  }
  await setFlowResponseLeadPointer(lead.tenantId, lead.flowResponseId, lead.leadId);
  return lead;
}

export type LeadUpdateInput = Partial<
  Pick<
    Lead,
    | "name"
    | "email"
    | "status"
    | "tags"
    | "notes"
    | "convertedAt"
  >
> & {
  assignedAdvisorId?: string | null;
};

export async function updateLead(
  tenantId: string,
  leadId: string,
  updates: LeadUpdateInput
): Promise<Lead | null> {
  const existing = await getLeadById(tenantId, leadId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const newStatus = updates.status ?? existing.status;
  const { assignedAdvisorId, ...rest } = updates;
  const merged: Lead = { ...existing, ...rest, status: newStatus, updatedAt: now };

  if (assignedAdvisorId === null) {
    delete merged.assignedAdvisorId;
  } else if (assignedAdvisorId !== undefined) {
    merged.assignedAdvisorId = assignedAdvisorId;
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...leadKeys(tenantId, leadId),
        ...gsi1Keys(tenantId, newStatus, existing.createdAt, leadId),
        ...merged,
      },
    })
  );

  if (ACTIVE_STATUSES.includes(newStatus)) {
    await setActiveLeadPointer(tenantId, merged.phone, leadId);
  } else {
    await clearActiveLeadPointer(tenantId, merged.phone);
  }

  return merged;
}

export async function deleteLead(tenantId: string, leadId: string): Promise<boolean> {
  const existing = await getLeadById(tenantId, leadId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: leadKeys(tenantId, leadId),
    })
  );
  await clearActiveLeadPointer(tenantId, existing.phone);
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: flowResponseLeadKeys(tenantId, existing.flowResponseId),
    })
  );
  return true;
}

export async function linkFlowResponseToLead(
  tenantId: string,
  flowResponseId: string,
  metaFlowId: string,
  createdAt: string,
  responseId: string,
  leadId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `FLOWRESP#${metaFlowId}#${createdAt}#${responseId}`,
      },
      UpdateExpression: "SET leadId = :leadId",
      ExpressionAttributeValues: { ":leadId": leadId },
    })
  );
  void flowResponseId;
}
