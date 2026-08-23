import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  MailrelayCampaignMetrics,
  MailrelayCampaignRecord,
  MailrelayConfig,
  MailrelayEmailTemplate,
  MailrelayEvent,
  MailrelaySubscriberLink,
  MailrelaySyncError,
  MailrelaySyncJob,
  MailrelaySyncJobStatus,
} from "../../types/index.js";

const tenantPk = (tenantId: string) => `TENANT#${tenantId}`;
const configKey = (tenantId: string) => ({ PK: tenantPk(tenantId), SK: "APP#mailrelay" });
const jobKey = (tenantId: string, jobId: string) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#SYNC#${jobId}`,
});
const subscriberKey = (tenantId: string, subscriberId: number) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#SUBSCRIBER#${subscriberId}`,
});
const subscriberEmailKey = (tenantId: string, email: string) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#EMAIL#${email.toLowerCase().trim()}`,
});
const campaignKey = (tenantId: string, campaignId: number) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#CAMPAIGN#${campaignId}`,
});
const metricsKey = (tenantId: string, campaignId: number) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#METRICS#${campaignId}`,
});
const eventKey = (tenantId: string, eventId: string) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#EVENT#${eventId}`,
});
const templateKey = (tenantId: string, templateId: string) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#TEMPLATE#${templateId}`,
});
const syncPageKey = (tenantId: string, jobId: string, pageToken: string) => ({
  PK: tenantPk(tenantId),
  SK: `MAILRELAY#SYNC#${jobId}#PAGE#${pageToken}`,
});
const globalMailrelayEmailKey = (email: string) => ({
  PK: `LOOKUP#MAILRELAY_EMAIL#${email.toLowerCase().trim()}`,
  SK: "METADATA",
});
const globalMailrelayCampaignKey = (campaignId: number) => ({
  PK: `LOOKUP#MAILRELAY_CAMPAIGN#${campaignId}`,
  SK: "METADATA",
});

function strip<T>(item: Record<string, unknown>): T {
  const { PK, SK, GSI1PK, GSI1SK, ttl, entityType, ...value } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  void ttl;
  void entityType;
  return value as T;
}

export async function getMailrelayConfig(tenantId: string): Promise<MailrelayConfig | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: configKey(tenantId) })
  );
  return result.Item ? strip<MailrelayConfig>(result.Item) : null;
}

export async function saveMailrelayConfig(
  tenantId: string,
  data: Pick<
    MailrelayConfig,
    | "enabled"
    | "defaultSenderId"
    | "tagGroupMappings"
    | "defaultGroupIds"
    | "eventTypes"
    | "eventSubscriptionId"
  >
): Promise<MailrelayConfig> {
  const existing = await getMailrelayConfig(tenantId);
  const now = new Date().toISOString();
  const config: MailrelayConfig = {
    tenantId,
    enabled: data.enabled,
    ...(data.defaultSenderId !== undefined ? { defaultSenderId: data.defaultSenderId } : {}),
    tagGroupMappings: data.tagGroupMappings,
    defaultGroupIds: data.defaultGroupIds,
    eventTypes: data.eventTypes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(data.eventSubscriptionId !== undefined
      ? { eventSubscriptionId: data.eventSubscriptionId }
      : existing?.eventSubscriptionId !== undefined
        ? { eventSubscriptionId: existing.eventSubscriptionId }
        : {}),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...configKey(tenantId), entityType: "MailrelayConfig", ...config },
    })
  );
  return config;
}

export async function clearMailrelayEventSubscriptionId(tenantId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: configKey(tenantId),
      UpdateExpression: "SET updatedAt = :updatedAt REMOVE eventSubscriptionId",
      ExpressionAttributeValues: { ":updatedAt": new Date().toISOString() },
    })
  );
}

export async function createMailrelaySyncJob(
  tenantId: string,
  jobId: string,
  requestedBy?: string
): Promise<MailrelaySyncJob> {
  const now = new Date().toISOString();
  const job: MailrelaySyncJob = {
    jobId,
    tenantId,
    status: "queued",
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    createdAt: now,
    updatedAt: now,
    ...(requestedBy ? { requestedBy } : {}),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...jobKey(tenantId, jobId),
        GSI1PK: `${tenantPk(tenantId)}#MAILRELAY_SYNCS`,
        GSI1SK: `${now}#${jobId}`,
        entityType: "MailrelaySyncJob",
        ...job,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return job;
}

export async function getMailrelaySyncJob(
  tenantId: string,
  jobId: string
): Promise<MailrelaySyncJob | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: jobKey(tenantId, jobId) })
  );
  return result.Item ? strip<MailrelaySyncJob>(result.Item) : null;
}

export async function listMailrelaySyncJobs(
  tenantId: string,
  limit = 50
): Promise<MailrelaySyncJob[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `${tenantPk(tenantId)}#MAILRELAY_SYNCS` },
      ScanIndexForward: false,
      Limit: Math.min(Math.max(limit, 1), 100),
    })
  );
  return (result.Items ?? []).map((item) => strip<MailrelaySyncJob>(item));
}

export async function updateMailrelaySyncJob(
  tenantId: string,
  jobId: string,
  updates: Partial<
    Pick<
      MailrelaySyncJob,
      | "status"
      | "total"
      | "processed"
      | "succeeded"
      | "failed"
      | "errors"
      | "startedAt"
      | "completedAt"
    >
  >
): Promise<MailrelaySyncJob | null> {
  const existing = await getMailrelaySyncJob(tenantId, jobId);
  if (!existing) return null;
  const job = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...jobKey(tenantId, jobId),
        GSI1PK: `${tenantPk(tenantId)}#MAILRELAY_SYNCS`,
        GSI1SK: `${existing.createdAt}#${jobId}`,
        entityType: "MailrelaySyncJob",
        ...job,
      },
      ConditionExpression: "attribute_exists(PK)",
    })
  );
  return job;
}

export async function completeMailrelaySyncJob(
  tenantId: string,
  jobId: string,
  results: { total: number; succeeded: number; errors: MailrelaySyncError[] }
): Promise<MailrelaySyncJob | null> {
  const failed = results.errors.length;
  const status: MailrelaySyncJobStatus =
    failed === 0 ? "completed" : results.succeeded > 0 ? "completed_with_errors" : "failed";
  return updateMailrelaySyncJob(tenantId, jobId, {
    status,
    total: results.total,
    processed: results.succeeded + failed,
    succeeded: results.succeeded,
    failed,
    errors: results.errors.slice(0, 100),
    completedAt: new Date().toISOString(),
  });
}

export interface MailrelaySyncPageState {
  nextCursor?: string;
  finished: boolean;
}

export async function getMailrelaySyncPageState(
  tenantId: string,
  jobId: string,
  pageToken: string
): Promise<MailrelaySyncPageState | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: syncPageKey(tenantId, jobId, pageToken),
    })
  );
  if (!result.Item) return null;
  return {
    finished: result.Item.finished === true,
    ...(typeof result.Item.nextCursor === "string"
      ? { nextCursor: result.Item.nextCursor }
      : {}),
  };
}

export async function commitMailrelaySyncPage(params: {
  tenantId: string;
  jobId: string;
  pageToken: string;
  nextCursor?: string;
  processed: number;
  succeeded: number;
  errors: MailrelaySyncError[];
}): Promise<MailrelaySyncJob> {
  const existing = await getMailrelaySyncJob(params.tenantId, params.jobId);
  if (!existing) throw new Error("Mailrelay sync job not found");
  const now = new Date().toISOString();
  const processed = existing.processed + params.processed;
  const succeeded = existing.succeeded + params.succeeded;
  const failed = existing.failed + params.errors.length;
  const finished = !params.nextCursor;
  const status: MailrelaySyncJobStatus = finished
    ? failed === 0
      ? "completed"
      : succeeded > 0
        ? "completed_with_errors"
        : "failed"
    : "running";
  const job: MailrelaySyncJob = {
    ...existing,
    status,
    processed,
    succeeded,
    failed,
    total: finished ? processed : Math.max(existing.total, processed + 1),
    errors: [...existing.errors, ...params.errors].slice(0, 100),
    updatedAt: now,
    ...(finished ? { completedAt: now } : {}),
  };

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...jobKey(params.tenantId, params.jobId),
              GSI1PK: `${tenantPk(params.tenantId)}#MAILRELAY_SYNCS`,
              GSI1SK: `${existing.createdAt}#${params.jobId}`,
              entityType: "MailrelaySyncJob",
              ...job,
            },
            ConditionExpression: "attribute_exists(PK)",
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...syncPageKey(params.tenantId, params.jobId, params.pageToken),
              entityType: "MailrelaySyncPage",
              finished,
              ...(params.nextCursor ? { nextCursor: params.nextCursor } : {}),
              createdAt: now,
              ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
      ],
    })
  );
  return job;
}

export async function saveMailrelaySubscriberLink(
  link: MailrelaySubscriberLink
): Promise<void> {
  const emailKey = subscriberEmailKey(link.tenantId, link.email);
  await Promise.all([
    docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...subscriberKey(link.tenantId, link.subscriberId),
          entityType: "MailrelaySubscriberLink",
          ...link,
          email: link.email.toLowerCase().trim(),
        },
      })
    ),
    docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...emailKey,
          entityType: "MailrelaySubscriberEmailLookup",
          subscriberId: link.subscriberId,
          email: link.email.toLowerCase().trim(),
          updatedAt: link.updatedAt,
        },
      })
    ),
    docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...globalMailrelayEmailKey(link.email),
          entityType: "MailrelayEmailTenantLookup",
          tenantId: link.tenantId,
          updatedAt: link.updatedAt,
        },
      })
    ),
  ]);
}

export async function findTenantIdByMailrelayEmail(email: string): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: globalMailrelayEmailKey(email) })
  );
  return typeof result.Item?.tenantId === "string" ? result.Item.tenantId : null;
}

export async function findTenantIdByMailrelayCampaign(campaignId: number): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: globalMailrelayCampaignKey(campaignId) })
  );
  return typeof result.Item?.tenantId === "string" ? result.Item.tenantId : null;
}

export async function getMailrelaySubscriberByEmail(
  tenantId: string,
  email: string
): Promise<MailrelaySubscriberLink | null> {
  const lookup = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: subscriberEmailKey(tenantId, email) })
  );
  const subscriberId = lookup.Item?.subscriberId;
  if (typeof subscriberId !== "number") return null;
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: subscriberKey(tenantId, subscriberId) })
  );
  return result.Item ? strip<MailrelaySubscriberLink>(result.Item) : null;
}

export async function saveMailrelayCampaignSnapshot(
  tenantId: string,
  remote: Record<string, unknown>
): Promise<MailrelayCampaignRecord | null> {
  const id = Number(remote.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const existing = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: campaignKey(tenantId, id) })
  );
  const now = new Date().toISOString();
  const record: MailrelayCampaignRecord = {
    tenantId,
    campaignId: id,
    remote,
    createdAt: existing.Item ? strip<MailrelayCampaignRecord>(existing.Item).createdAt : now,
    updatedAt: now,
    ...(typeof remote.subject === "string" ? { subject: remote.subject } : {}),
    ...(typeof remote.status === "string" ? { status: remote.status } : {}),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...campaignKey(tenantId, id), entityType: "MailrelayCampaign", ...record },
    })
  );
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...globalMailrelayCampaignKey(id),
        entityType: "MailrelayCampaignTenantLookup",
        tenantId,
        updatedAt: now,
      },
    })
  );
  return record;
}

export async function getMailrelayCampaignMetrics(
  tenantId: string,
  campaignId: number
): Promise<MailrelayCampaignMetrics> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: metricsKey(tenantId, campaignId) })
  );
  if (result.Item) return strip<MailrelayCampaignMetrics>(result.Item);
  return {
    tenantId,
    campaignId,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    complained: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function incrementMailrelayCampaignMetric(
  tenantId: string,
  campaignId: number,
  metric: keyof Pick<
    MailrelayCampaignMetrics,
    "sent" | "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed" | "complained"
  >
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: metricsKey(tenantId, campaignId),
      UpdateExpression:
        "SET entityType = :type, tenantId = :tenantId, campaignId = :campaignId, updatedAt = :now ADD #metric :one",
      ExpressionAttributeNames: { "#metric": metric },
      ExpressionAttributeValues: {
        ":type": "MailrelayCampaignMetrics",
        ":tenantId": tenantId,
        ":campaignId": campaignId,
        ":now": new Date().toISOString(),
        ":one": 1,
      },
    })
  );
}

export async function recordMailrelayEvent(event: MailrelayEvent): Promise<boolean> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...eventKey(event.tenantId, event.eventId),
          GSI1PK: `${tenantPk(event.tenantId)}#MAILRELAY_EVENTS`,
          GSI1SK: `${event.occurredAt}#${event.eventId}`,
          entityType: "MailrelayEvent",
          ...event,
          ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

export async function listMailrelayEvents(
  tenantId: string,
  options: { limit?: number; campaignId?: number } = {}
): Promise<MailrelayEvent[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": tenantPk(tenantId),
        ":prefix": "MAILRELAY#EVENT#",
      },
      Limit: limit * 4,
    })
  );
  const events = (result.Items ?? [])
    .map((item) => strip<MailrelayEvent>(item))
    .filter((event) =>
      options.campaignId ? event.campaignId === options.campaignId : true
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  return events.slice(0, limit);
}

export async function listMailrelayCampaignMetrics(
  tenantId: string
): Promise<MailrelayCampaignMetrics[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": tenantPk(tenantId),
        ":prefix": "MAILRELAY#METRICS#",
      },
    })
  );
  return (result.Items ?? []).map((item) => strip<MailrelayCampaignMetrics>(item));
}

export async function listMailrelayEmailTemplates(
  tenantId: string
): Promise<MailrelayEmailTemplate[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": tenantPk(tenantId),
        ":prefix": "MAILRELAY#TEMPLATE#",
      },
      ScanIndexForward: false,
    })
  );
  return (result.Items ?? []).map((item) => strip<MailrelayEmailTemplate>(item));
}

export async function getMailrelayEmailTemplate(
  tenantId: string,
  templateId: string
): Promise<MailrelayEmailTemplate | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: templateKey(tenantId, templateId) })
  );
  return result.Item ? strip<MailrelayEmailTemplate>(result.Item) : null;
}

export async function saveMailrelayEmailTemplate(
  tenantId: string,
  templateId: string,
  data: Pick<MailrelayEmailTemplate, "name" | "subject" | "previewText" | "html">
): Promise<MailrelayEmailTemplate> {
  const existing = await getMailrelayEmailTemplate(tenantId, templateId);
  const now = new Date().toISOString();
  const template: MailrelayEmailTemplate = {
    templateId,
    tenantId,
    name: data.name,
    subject: data.subject,
    html: data.html,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(data.previewText ? { previewText: data.previewText } : {}),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...templateKey(tenantId, templateId), entityType: "MailrelayEmailTemplate", ...template },
    })
  );
  return template;
}

export async function deleteMailrelayEmailTemplate(
  tenantId: string,
  templateId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: templateKey(tenantId, templateId),
    })
  );
}
