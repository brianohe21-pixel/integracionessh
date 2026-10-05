import { randomUUID } from "crypto";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import { assertTenantManagerRole, resolveRequestAuth } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import {
  createMailrelaySyncJob,
  deleteMailrelayCampaignRecord,
  deleteMailrelayEmailTemplate,
  getMailrelayCampaignMetrics,
  getMailrelayCampaignRecord,
  getMailrelayConfig,
  getMailrelayEmailTemplate,
  getMailrelaySyncJob,
  listMailrelayCampaignMetrics,
  listMailrelayCampaignRecords,
  listMailrelayEmailTemplates,
  listMailrelayEvents,
  listMailrelayEventsInRange,
  listMailrelaySyncJobs,
  saveMailrelayCampaignSnapshot,
  saveMailrelayConfig,
  saveMailrelayEmailTemplate,
  updateMailrelaySyncJob,
} from "../../lib/dynamodb/mailrelay.repository.js";
import {
  accepted,
  badRequest,
  created,
  handleError,
  notFound,
  ok,
  parseJsonBody,
} from "../../lib/http.js";
import { buildMailrelaySendPayload, ensureMailrelayCampaignHtml } from "../../lib/mailrelay/campaign.js";
import {
  buildMailrelayDeliverabilityFromMetrics,
  buildMailrelayDeliverabilityReport,
  mailrelayCampaignDisplayName,
  parseMailrelayDeliverabilityRange,
} from "../../lib/mailrelay/deliverability.js";
import { createMailrelayClient, type MailrelayClient } from "../../lib/mailrelay/client.js";
import {
  getMailrelayCredentials,
  maskMailrelayCredentials,
} from "../../lib/mailrelay/secrets.js";
import {
  configuredMailrelayEventTypes,
  ensureMailrelayEventSubscription,
} from "../../lib/mailrelay/subscription.js";
import { enqueueMailrelaySync } from "../../lib/mailrelay/sync-queue.js";
import { ensureNrs360CampaignHtml, metricsFromNrs360Campaign } from "../../lib/nrs360/campaign.js";
import { formatNrs360ScheduleDate, type Nrs360Client } from "../../lib/nrs360/client.js";
import {
  createAuthenticatedNrs360Client,
  getMaskedEmailMarketingCredentials,
  requireNrs360Sender,
  resolveProvider,
} from "../../lib/nrs360/provider.js";
import {
  deleteNrs360Credentials,
  getNrs360Credentials,
  maskNrs360Credentials,
  saveNrs360Credentials,
} from "../../lib/nrs360/secrets.js";
import type {
  EmailMarketingProvider,
  MailrelayConfig,
  MailrelayGroup,
  MailrelayOverview,
  MailrelaySender,
  MailrelaySyncQueueMessage,
} from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const SYNC_QUEUE_URL = process.env.MAILRELAY_SYNC_QUEUE_URL ?? "";

const ConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["mailrelay", "nrs360"]).optional(),
  defaultSenderId: z.number().int().positive().optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(128).optional(),
  replyTo: z.string().email().optional(),
  defaultGroupIds: z.array(z.number().int().positive()).max(100).default([]),
  tagGroupMappings: z
    .array(
      z.object({
        tag: z.string().trim().min(1).max(100),
        groupIds: z.array(z.number().int().positive()).max(100),
      })
    )
    .max(100)
    .default([]),
});

const CredentialsSchema = z.object({
  username: z.string().trim().min(1).max(200),
  apiPassword: z.string().trim().min(1).max(500),
  baseUrl: z.string().trim().max(500).optional(),
});

const CampaignSchema = z
  .object({
    sender_id: z.number().int().positive().optional(),
    subject: z.string().min(1).max(500),
    preview_text: z.string().max(500).optional(),
    html: z.string().min(1),
    target: z.string().min(1),
    segment_id: z.number().int().positive().optional(),
    group_ids: z.array(z.number().int().positive()).optional(),
    campaign_folder_id: z.number().int().positive().optional(),
    url_token: z.boolean().optional(),
    analytics_utm_campaign: z.string().max(500).optional(),
    use_premailer: z.boolean().optional(),
    reply_to: z.string().email().optional(),
    track_opens: z.boolean().optional(),
    track_clicks: z.boolean().optional(),
    name: z.string().max(200).optional(),
  })
  .passthrough();

const UpdateCampaignSchema = CampaignSchema.partial();
const SendTestSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(25),
});

const SendCampaignSchema = z
  .object({
    target: z.string().min(1).optional(),
    group_ids: z.array(z.number().int().positive()).optional(),
    segment_id: z.number().int().positive().optional(),
    scheduled_at: z.string().min(1).optional(),
    callback_url: z.string().url().optional(),
  })
  .optional();

const TemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(500),
  previewText: z.string().trim().max(500).optional(),
  html: z.string().min(1),
});

const UpdateTemplateSchema = TemplateSchema.partial();

function defaultConfig(tenantId: string): MailrelayConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    enabled: true,
    provider: "mailrelay",
    defaultGroupIds: [],
    tagGroupMappings: [],
    eventTypes: configuredMailrelayEventTypes(),
    createdAt: now,
    updatedAt: now,
  };
}

function remoteRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const data = record.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return record;
  }
  return {};
}

function positiveId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function nextLocalCampaignId(): number {
  return Date.now();
}

async function loadTenantConfig(tenantId: string): Promise<MailrelayConfig> {
  return (await getMailrelayConfig(tenantId)) ?? defaultConfig(tenantId);
}

async function authenticatedMailrelayClient(): Promise<{
  client: MailrelayClient;
  credentials: NonNullable<Awaited<ReturnType<typeof getMailrelayCredentials>>>;
}> {
  const credentials = await getMailrelayCredentials(ENVIRONMENT);
  if (!credentials) {
    const error = new Error("Email marketing is not configured for this platform");
    (error as Error & { statusCode: number }).statusCode = 400;
    throw error;
  }
  return { client: createMailrelayClient(credentials), credentials };
}

async function registerPlatformSubscription(): Promise<void> {
  const { client, credentials } = await authenticatedMailrelayClient();
  await ensureMailrelayEventSubscription({ credentials, client });
}

function groupSubscriberCount(group: MailrelayGroup): number {
  const count = group.subscriber_count ?? group.subscriberCount ?? group.subscribers_count;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

async function buildMailrelayOverview(
  tenantId: string,
  client: MailrelayClient
): Promise<MailrelayOverview> {
  const [groups, syncJobs, draftPage, sentPage, metricsList, templates] = await Promise.all([
    client.all<MailrelayGroup>("/groups"),
    listMailrelaySyncJobs(tenantId, 1),
    client.page<Record<string, unknown>>("/campaigns", { page: 1, per_page: 100 }),
    client.page<Record<string, unknown>>("/sent_campaigns", { page: 1, per_page: 100 }),
    listMailrelayCampaignMetrics(tenantId),
    listMailrelayEmailTemplates(tenantId),
  ]);

  const subscriberCount = groups.reduce((sum, group) => sum + groupSubscriberCount(group), 0);
  const draftCampaigns = draftPage.items.filter((campaign) => {
    const status = String(campaign.status ?? "draft").toLowerCase();
    return status !== "sent" && status !== "sending";
  }).length;
  const sentCampaigns = sentPage.items.length;
  const deliveredTotal = metricsList.reduce((sum, metrics) => sum + metrics.delivered, 0);
  const openedTotal = metricsList.reduce((sum, metrics) => sum + metrics.opened, 0);
  const clickedTotal = metricsList.reduce((sum, metrics) => sum + metrics.clicked, 0);
  const lastSync = syncJobs[0];

  return {
    subscriberCount,
    draftCampaigns,
    sentCampaigns,
    templateCount: templates.length,
    averageOpenRate: deliveredTotal > 0 ? openedTotal / deliveredTotal : 0,
    averageClickRate: deliveredTotal > 0 ? clickedTotal / deliveredTotal : 0,
    ...(lastSync?.createdAt ? { lastSyncAt: lastSync.createdAt } : {}),
    ...(lastSync?.status ? { lastSyncStatus: lastSync.status } : {}),
  };
}

async function buildNrs360Overview(
  tenantId: string,
  client: Nrs360Client
): Promise<MailrelayOverview> {
  const [groups, syncJobs, localCampaigns, remoteCampaigns, templates] = await Promise.all([
    client.listGroups(),
    listMailrelaySyncJobs(tenantId, 1),
    listMailrelayCampaignRecords(tenantId),
    client.listMailingCampaigns(),
    listMailrelayEmailTemplates(tenantId),
  ]);
  const draftCampaigns = localCampaigns.filter(
    (record) => String(record.status ?? record.remote.status ?? "draft") === "draft"
  ).length;
  let openedTotal = 0;
  let clickedTotal = 0;
  let deliveredTotal = 0;
  for (const campaign of remoteCampaigns) {
    const metrics = metricsFromNrs360Campaign(campaign);
    openedTotal += metrics.opened;
    clickedTotal += metrics.clicked;
    deliveredTotal += metrics.delivered;
  }
  const lastSync = syncJobs[0];
  return {
    subscriberCount: groups.length,
    draftCampaigns,
    sentCampaigns: remoteCampaigns.length,
    templateCount: templates.length,
    averageOpenRate: deliveredTotal > 0 ? openedTotal / deliveredTotal : 0,
    averageClickRate: deliveredTotal > 0 ? clickedTotal / deliveredTotal : 0,
    ...(lastSync?.createdAt ? { lastSyncAt: lastSync.createdAt } : {}),
    ...(lastSync?.status ? { lastSyncStatus: lastSync.status } : {}),
  };
}

async function handleTemplateRoutes(
  method: string,
  segments: string[],
  tenantId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  provider: EmailMarketingProvider
): Promise<APIGatewayProxyResultV2 | null> {
  if (segments[0] !== "templates") return null;
  const templateId = segments[1];
  const ensureHtml =
    provider === "nrs360" ? ensureNrs360CampaignHtml : ensureMailrelayCampaignHtml;

  if (method === "GET" && !templateId) {
    const templates = await listMailrelayEmailTemplates(tenantId);
    return ok({ templates });
  }
  if (method === "POST" && !templateId) {
    const body = TemplateSchema.parse(parseJsonBody(event));
    const id = randomUUID();
    const template = await saveMailrelayEmailTemplate(tenantId, id, {
      name: body.name,
      subject: body.subject,
      html: ensureHtml(body.html),
      ...(body.previewText ? { previewText: body.previewText } : {}),
    });
    return created({ template });
  }
  if (!templateId) return badRequest("Invalid template id");

  if (method === "GET") {
    const template = await getMailrelayEmailTemplate(tenantId, templateId);
    return template ? ok({ template }) : notFound("Template not found");
  }
  if (method === "PUT" || method === "PATCH") {
    const existing = await getMailrelayEmailTemplate(tenantId, templateId);
    if (!existing) return notFound("Template not found");
    const body = UpdateTemplateSchema.parse(parseJsonBody(event));
    const previewText = body.previewText ?? existing.previewText;
    const template = await saveMailrelayEmailTemplate(tenantId, templateId, {
      name: body.name ?? existing.name,
      subject: body.subject ?? existing.subject,
      html: ensureHtml(body.html ?? existing.html),
      ...(previewText ? { previewText } : {}),
    });
    return ok({ template });
  }
  if (method === "DELETE") {
    await deleteMailrelayEmailTemplate(tenantId, templateId);
    return ok({ template: { templateId, deleted: true } });
  }
  return badRequest("Not found");
}

function resourceSegments(event: APIGatewayProxyEventV2WithJWTAuthorizer): string[] {
  const path = event.rawPath ?? event.requestContext.http.path ?? "";
  const segments = path.split("/").filter(Boolean);
  const index = segments.lastIndexOf("email-marketing");
  return index >= 0 ? segments.slice(index + 1) : segments;
}

function localCampaignPayload(
  body: z.infer<typeof CampaignSchema>,
  config: MailrelayConfig,
  id: number,
  status = "draft"
): Record<string, unknown> {
  const sender = requireNrs360Sender(config);
  const now = new Date().toISOString();
  return {
    id,
    name: body.name?.trim() || body.subject,
    subject: body.subject,
    preview_text: body.preview_text ?? "",
    html: ensureNrs360CampaignHtml(body.html),
    target: body.target,
    group_ids: body.group_ids ?? [],
    reply_to: body.reply_to ?? sender.replyTo,
    fromEmail: sender.fromEmail,
    fromName: sender.fromName ?? "",
    track_opens: body.track_opens ?? true,
    track_clicks: body.track_clicks ?? true,
    status,
    created_at: now,
    updated_at: now,
  };
}

async function handleNrs360CampaignRoutes(
  method: string,
  segments: string[],
  tenantId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  config: MailrelayConfig
): Promise<APIGatewayProxyResultV2 | null> {
  if (segments[0] !== "campaigns") return null;
  const id = positiveId(segments[1]);
  const { client } = await createAuthenticatedNrs360Client(ENVIRONMENT, tenantId);

  if (method === "GET" && !id) {
    const records = await listMailrelayCampaignRecords(tenantId);
    const campaigns = records
      .map((record) => ({
        id: record.campaignId,
        ...record.remote,
        status: record.status ?? record.remote.status ?? "draft",
        subject: record.subject ?? record.remote.subject,
      }))
      .sort((a, b) => Number(b.id) - Number(a.id));
    const page = Number(event.queryStringParameters?.page ?? 1);
    const perPage = Number(event.queryStringParameters?.per_page ?? 100);
    const start = (page - 1) * perPage;
    const items = campaigns.slice(start, start + perPage);
    return ok({
      campaigns: items,
      pagination: {
        items,
        page,
        perPage,
        hasMore: start + perPage < campaigns.length,
        totalPages: Math.max(1, Math.ceil(campaigns.length / perPage)),
      },
    });
  }

  if (method === "POST" && !id) {
    const body = CampaignSchema.parse(parseJsonBody(event));
    if (body.target !== "groups" || !body.group_ids?.length) {
      return badRequest("360nrs campaigns require at least one audience group");
    }
    const campaignId = nextLocalCampaignId();
    const campaign = localCampaignPayload(body, config, campaignId);
    await saveMailrelayCampaignSnapshot(tenantId, campaign);
    return created({ campaign });
  }

  if (!id) return badRequest("Invalid campaign id");
  const existing = await getMailrelayCampaignRecord(tenantId, id);
  if (!existing) return notFound("Campaign not found");

  if (method === "GET" && segments.length === 2) {
    return ok({
      campaign: {
        id,
        ...existing.remote,
        status: existing.status ?? existing.remote.status ?? "draft",
      },
    });
  }

  if ((method === "PUT" || method === "PATCH") && segments.length === 2) {
    const body = UpdateCampaignSchema.parse(parseJsonBody(event));
    const merged = {
      ...existing.remote,
      ...body,
      id,
      html:
        body.html !== undefined
          ? ensureNrs360CampaignHtml(body.html)
          : String(existing.remote.html ?? ""),
      updated_at: new Date().toISOString(),
    };
    await saveMailrelayCampaignSnapshot(tenantId, merged);
    return ok({ campaign: merged });
  }

  if (method === "DELETE" && segments.length === 2) {
    await deleteMailrelayCampaignRecord(tenantId, id);
    return ok({ campaign: { id, deleted: true } });
  }

  if (method === "POST" && segments[2] === "send-test") {
    const body = SendTestSchema.parse(parseJsonBody(event));
    const sender = requireNrs360Sender(config);
    const remote = existing.remote;
    await client.sendMailing({
      to: body.emails,
      fromEmail: sender.fromEmail,
      replyTo: String(remote.reply_to ?? sender.replyTo),
      subject: String(remote.subject ?? "Test"),
      body: ensureNrs360CampaignHtml(String(remote.html ?? "")),
      campaignName: `TEST_${String(remote.name ?? remote.subject ?? id).slice(0, 40)}`,
      trackOpens: Boolean(remote.track_opens ?? true),
      trackClicks: Boolean(remote.track_clicks ?? true),
      ...(sender.fromName ? { fromName: sender.fromName } : {}),
    });
    return ok({ campaign: { id, testSent: true } });
  }

  if (method === "POST" && segments[2] === "send") {
    const override = SendCampaignSchema.parse(parseJsonBody(event)) ?? {};
    const sender = requireNrs360Sender(config);
    const remote = existing.remote;
    const groupIds =
      override.group_ids ??
      (Array.isArray(remote.group_ids)
        ? remote.group_ids.map(Number).filter((value) => Number.isInteger(value) && value > 0)
        : []);
    if (groupIds.length === 0) {
      return badRequest("Campaign audience groups are missing");
    }
    const recipients = await client.listGroupEmails(groupIds);
    if (recipients.length === 0) {
      return badRequest("No contacts found in the selected groups");
    }
    const result = await client.sendMailing({
      to: recipients,
      fromEmail: sender.fromEmail,
      replyTo: String(remote.reply_to ?? sender.replyTo),
      subject: String(remote.subject ?? ""),
      body: ensureNrs360CampaignHtml(String(remote.html ?? "")),
      campaignName: String(remote.name ?? remote.subject ?? `campaign_${id}`).slice(0, 80),
      trackOpens: Boolean(remote.track_opens ?? true),
      trackClicks: Boolean(remote.track_clicks ?? true),
      ...(sender.fromName ? { fromName: sender.fromName } : {}),
      ...(override.scheduled_at
        ? { scheduleDate: formatNrs360ScheduleDate(override.scheduled_at) }
        : {}),
    });
    const campaign = {
      ...remote,
      id,
      status: override.scheduled_at ? "sending" : "sent",
      sent_at: new Date().toISOString(),
      nrsCampaignId: result.campaignId,
      nrsSendingId: result.sendingId,
      messageIds: result.messageIds,
    };
    await saveMailrelayCampaignSnapshot(tenantId, campaign);
    return accepted({ campaign });
  }

  return badRequest("Not found");
}

async function handleMailrelayCampaignRoutes(
  method: string,
  segments: string[],
  tenantId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2 | null> {
  if (segments[0] !== "campaigns") return null;
  const id = positiveId(segments[1]);
  const { client } = await authenticatedMailrelayClient();

  if (method === "GET" && !id) {
    const page = await client.page<Record<string, unknown>>("/campaigns", {
      page: event.queryStringParameters?.page ?? "1",
      per_page: event.queryStringParameters?.per_page ?? "100",
    });
    return ok({ campaigns: page.items, pagination: page });
  }
  if (method === "POST" && !id) {
    const body = CampaignSchema.parse(parseJsonBody(event));
    if (!body.sender_id) return badRequest("sender_id is required");
    const campaign = remoteRecord(
      await client.request("POST", "/campaigns", {
        body: { ...body, html: ensureMailrelayCampaignHtml(body.html) },
      })
    );
    await saveMailrelayCampaignSnapshot(tenantId, campaign);
    return created({ campaign });
  }
  if (!id) return badRequest("Invalid campaign id");

  if (method === "GET" && segments.length === 2) {
    const campaign = remoteRecord(await client.request("GET", `/campaigns/${id}`));
    await saveMailrelayCampaignSnapshot(tenantId, campaign);
    return ok({ campaign });
  }
  if ((method === "PUT" || method === "PATCH") && segments.length === 2) {
    const body = UpdateCampaignSchema.parse(parseJsonBody(event));
    const campaign = remoteRecord(
      await client.request("PATCH", `/campaigns/${id}`, {
        body: {
          ...body,
          ...(body.html !== undefined
            ? { html: ensureMailrelayCampaignHtml(body.html) }
            : {}),
        },
      })
    );
    await saveMailrelayCampaignSnapshot(tenantId, campaign);
    return ok({ campaign });
  }
  if (method === "DELETE" && segments.length === 2) {
    await client.request("DELETE", `/campaigns/${id}`);
    return ok({ campaign: { id, deleted: true } });
  }
  if (method === "POST" && segments[2] === "send-test") {
    const body = SendTestSchema.parse(parseJsonBody(event));
    await client.request("POST", `/campaigns/${id}/send_test`, {
      body: { test_emails: body.emails.join(",") },
    });
    return ok({ campaign: { id, testSent: true } });
  }
  if (method === "POST" && segments[2] === "send") {
    const override = SendCampaignSchema.parse(parseJsonBody(event));
    const existing = remoteRecord(await client.request("GET", `/campaigns/${id}`));
    const campaign = remoteRecord(
      await client.request("POST", `/campaigns/${id}/send_all`, {
        body: buildMailrelaySendPayload(existing, override ?? {}),
      })
    );
    await saveMailrelayCampaignSnapshot(tenantId, {
      id,
      ...campaign,
      status: campaign.status ?? "sending",
    });
    return accepted({ campaign: { id, ...campaign } });
  }
  return badRequest("Not found");
}

async function handleSentCampaignRoutes(
  method: string,
  segments: string[],
  tenantId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  provider: EmailMarketingProvider
): Promise<APIGatewayProxyResultV2 | null> {
  if (segments[0] !== "sent-campaigns" || method !== "GET") return null;

  if (provider === "nrs360") {
    const { client } = await createAuthenticatedNrs360Client(ENVIRONMENT, tenantId);
    const id = positiveId(segments[1]);
    const campaigns = await client.listMailingCampaigns();
    if (!id) {
      return ok({
        campaigns,
        pagination: {
          items: campaigns,
          page: 1,
          perPage: campaigns.length || 100,
          hasMore: false,
          totalPages: 1,
        },
      });
    }
    const campaign = campaigns.find((item) => Number(item.id) === id);
    if (!campaign) return notFound("Campaign not found");
    if (segments[2] === "metrics") {
      const values = metricsFromNrs360Campaign(campaign);
      return ok({
        metrics: {
          tenantId,
          campaignId: id,
          ...values,
          genericBounced: 0,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    return ok({
      campaign,
      metrics: {
        tenantId,
        campaignId: id,
        ...metricsFromNrs360Campaign(campaign),
        genericBounced: 0,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  const { client } = await authenticatedMailrelayClient();
  const id = positiveId(segments[1]);
  if (!id) {
    const page = await client.page<Record<string, unknown>>("/sent_campaigns", {
      page: event.queryStringParameters?.page ?? "1",
      per_page: event.queryStringParameters?.per_page ?? "100",
    });
    return ok({ campaigns: page.items, pagination: page });
  }
  if (segments[2] === "metrics") {
    return ok({ metrics: await getMailrelayCampaignMetrics(tenantId, id) });
  }
  const campaign = remoteRecord(await client.request("GET", `/sent_campaigns/${id}`));
  await saveMailrelayCampaignSnapshot(tenantId, { id, ...campaign });
  const metrics = await getMailrelayCampaignMetrics(tenantId, id);
  return ok({ campaign: { id, ...campaign }, metrics });
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertTenantManagerRole(auth);
    await assertAssignedServices(auth.tenantId, "emailMarketing");
    const method = event.requestContext.http.method;
    const segments = resourceSegments(event);
    const config = await loadTenantConfig(auth.tenantId);
    const provider = resolveProvider(config);

    if (segments[0] === "credentials") {
      if (method === "GET") {
        const credentials = await getMaskedEmailMarketingCredentials({
          environment: ENVIRONMENT,
          tenantId: auth.tenantId,
          provider,
        });
        return ok({ credentials, provider });
      }
      if (method === "PUT") {
        if (provider !== "nrs360") {
          return badRequest("Only 360nrs credentials can be saved per tenant");
        }
        const body = CredentialsSchema.parse(parseJsonBody(event));
        const saved = await saveNrs360Credentials(ENVIRONMENT, auth.tenantId, {
          username: body.username,
          apiPassword: body.apiPassword,
          ...(body.baseUrl ? { baseUrl: body.baseUrl } : {}),
        });
        return ok({ credentials: maskNrs360Credentials(saved), provider });
      }
      if (method === "DELETE") {
        if (provider !== "nrs360") {
          return badRequest("Only 360nrs credentials can be deleted per tenant");
        }
        await deleteNrs360Credentials(ENVIRONMENT, auth.tenantId);
        return ok({ credentials: maskNrs360Credentials(null), provider });
      }
    }

    if (segments[0] === "test" && method === "POST") {
      if (provider === "nrs360") {
        const { client, credentials } = await createAuthenticatedNrs360Client(
          ENVIRONMENT,
          auth.tenantId
        );
        const ping = await client.ping();
        return ok({
          success: true,
          ping,
          credentials: maskNrs360Credentials(credentials),
          provider,
        });
      }
      const { client, credentials } = await authenticatedMailrelayClient();
      const ping = await client.ping();
      await registerPlatformSubscription();
      return ok({
        success: true,
        ping,
        credentials: maskMailrelayCredentials(credentials),
        provider,
      });
    }

    if (segments[0] === "config") {
      if (method === "GET") {
        return ok({ config });
      }
      if (method === "PUT") {
        const body = ConfigSchema.parse(parseJsonBody(event));
        const nextProvider = body.provider ?? provider;
        if (nextProvider === "nrs360") {
          const fromEmail = body.fromEmail ?? config.fromEmail;
          const replyTo = body.replyTo ?? config.replyTo ?? fromEmail;
          if (fromEmail && !replyTo) {
            return badRequest("replyTo is required when fromEmail is set for 360nrs");
          }
        }
        const saved = await saveMailrelayConfig(auth.tenantId, {
          enabled: body.enabled,
          provider: nextProvider,
          defaultGroupIds: body.defaultGroupIds,
          tagGroupMappings: body.tagGroupMappings,
          eventTypes: configuredMailrelayEventTypes(),
          ...(body.defaultSenderId !== undefined
            ? { defaultSenderId: body.defaultSenderId }
            : {}),
          ...(body.fromEmail !== undefined ? { fromEmail: body.fromEmail } : {}),
          ...(body.fromName !== undefined ? { fromName: body.fromName } : {}),
          ...(body.replyTo !== undefined ? { replyTo: body.replyTo } : {}),
        });
        return ok({ config: saved });
      }
    }

    if (segments[0] === "groups" && method === "GET") {
      if (provider === "nrs360") {
        const { client } = await createAuthenticatedNrs360Client(ENVIRONMENT, auth.tenantId);
        const groups = await client.listGroups();
        return ok({ groups });
      }
      const { client } = await authenticatedMailrelayClient();
      const groups = await client.all<MailrelayGroup>("/groups");
      return ok({ groups });
    }

    if (segments[0] === "senders" && method === "GET") {
      if (provider === "nrs360") {
        const sender = config.fromEmail
          ? [
              {
                id: 1,
                name: config.fromName || config.fromEmail,
                email: config.fromEmail,
              } satisfies MailrelaySender,
            ]
          : [];
        return ok({ senders: sender });
      }
      const { client } = await authenticatedMailrelayClient();
      const senders = await client.all<MailrelaySender>("/senders");
      return ok({ senders });
    }

    if (segments[0] === "segments" && method === "GET") {
      if (provider === "nrs360") return ok({ segments: [] });
      const { client } = await authenticatedMailrelayClient();
      const segmentsList = await client.all<Record<string, unknown>>("/segments");
      return ok({ segments: segmentsList });
    }

    if (segments[0] === "campaign-folders" && method === "GET") {
      if (provider === "nrs360") return ok({ folders: [] });
      const { client } = await authenticatedMailrelayClient();
      const folders = await client.all<Record<string, unknown>>("/campaign_folders");
      return ok({ folders });
    }

    if (segments[0] === "overview" && method === "GET") {
      if (provider === "nrs360") {
        const { client } = await createAuthenticatedNrs360Client(ENVIRONMENT, auth.tenantId);
        return ok({ overview: await buildNrs360Overview(auth.tenantId, client) });
      }
      const { client } = await authenticatedMailrelayClient();
      return ok({ overview: await buildMailrelayOverview(auth.tenantId, client) });
    }

    if (segments[0] === "deliverability" && method === "GET") {
      if (provider === "nrs360") {
        const { client } = await createAuthenticatedNrs360Client(ENVIRONMENT, auth.tenantId);
        const campaigns = await client.listMailingCampaigns();
        const metrics = campaigns.map((campaign) => {
          const campaignId = Number(campaign.id);
          const values = metricsFromNrs360Campaign(campaign);
          return {
            tenantId: auth.tenantId,
            campaignId: Number.isInteger(campaignId) ? campaignId : 0,
            ...values,
            genericBounced: 0,
            updatedAt: new Date().toISOString(),
          };
        });
        const names = new Map(
          campaigns.map((campaign) => [
            Number(campaign.id) || 0,
            String(campaign.name ?? campaign.id ?? "Campaign"),
          ])
        );
        return ok({
          report: buildMailrelayDeliverabilityFromMetrics({ metrics, names }),
        });
      }

      const names = new Map(
        (await listMailrelayCampaignRecords(auth.tenantId)).map((record) => [
          record.campaignId,
          mailrelayCampaignDisplayName(record),
        ])
      );
      const from = event.queryStringParameters?.from ?? "";
      const to = event.queryStringParameters?.to ?? "";
      if (from || to) {
        const range = parseMailrelayDeliverabilityRange(from, to);
        if (!range.ok) return badRequest(range.message);
        const events = await listMailrelayEventsInRange(auth.tenantId, range.from, range.to);
        return ok({
          report: buildMailrelayDeliverabilityReport({
            from: range.from,
            to: range.to,
            events,
            names,
          }),
        });
      }
      const metrics = await listMailrelayCampaignMetrics(auth.tenantId);
      return ok({
        report: buildMailrelayDeliverabilityFromMetrics({ metrics, names }),
      });
    }

    if (segments[0] === "events" && method === "GET") {
      if (provider === "nrs360") return ok({ events: [] });
      const campaignId = positiveId(event.queryStringParameters?.campaignId);
      const limit = Number(event.queryStringParameters?.limit ?? 50);
      const events = await listMailrelayEvents(auth.tenantId, {
        limit,
        ...(campaignId ? { campaignId } : {}),
      });
      return ok({ events });
    }

    if (segments[0] === "sync" && method === "POST") {
      if (provider === "nrs360") {
        await getNrs360Credentials(ENVIRONMENT, auth.tenantId).then((credentials) => {
          if (!credentials) {
            throw Object.assign(new Error("360nrs credentials are not configured"), {
              statusCode: 400,
            });
          }
        });
      } else {
        await authenticatedMailrelayClient();
      }
      const jobId = randomUUID();
      const job = await createMailrelaySyncJob(auth.tenantId, jobId, auth.userId);
      try {
        const message: MailrelaySyncQueueMessage = { tenantId: auth.tenantId, jobId };
        await enqueueMailrelaySync(SYNC_QUEUE_URL, message);
      } catch (error) {
        await updateMailrelaySyncJob(auth.tenantId, jobId, {
          status: "failed",
          errors: [
            {
              message: error instanceof Error ? error.message : "Failed to enqueue sync",
            },
          ],
          completedAt: new Date().toISOString(),
        });
        throw error;
      }
      return accepted({ job });
    }

    if (segments[0] === "syncs" && method === "GET") {
      if (segments[1]) {
        const job = await getMailrelaySyncJob(auth.tenantId, segments[1]);
        return job ? ok({ job }) : notFound("Sync job not found");
      }
      const jobs = await listMailrelaySyncJobs(
        auth.tenantId,
        Number(event.queryStringParameters?.limit ?? 50)
      );
      return ok({ jobs });
    }

    const campaignResult =
      provider === "nrs360"
        ? await handleNrs360CampaignRoutes(method, segments, auth.tenantId, event, config)
        : await handleMailrelayCampaignRoutes(method, segments, auth.tenantId, event);
    if (campaignResult) return campaignResult;

    const sentCampaignResult = await handleSentCampaignRoutes(
      method,
      segments,
      auth.tenantId,
      event,
      provider
    );
    if (sentCampaignResult) return sentCampaignResult;

    const templateResult = await handleTemplateRoutes(
      method,
      segments,
      auth.tenantId,
      event,
      provider
    );
    if (templateResult) return templateResult;
    return badRequest("Not found");
  } catch (error) {
    return handleError(error);
  }
}
