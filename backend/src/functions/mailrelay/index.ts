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
  getMailrelayCampaignMetrics,
  getMailrelayConfig,
  getMailrelaySyncJob,
  listMailrelaySyncJobs,
  saveMailrelayCampaignSnapshot,
  saveMailrelayConfig,
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
import type {
  MailrelayConfig,
  MailrelayGroup,
  MailrelaySender,
  MailrelaySyncQueueMessage,
} from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const SYNC_QUEUE_URL = process.env.MAILRELAY_SYNC_QUEUE_URL ?? "";

const ConfigSchema = z.object({
  enabled: z.boolean(),
  defaultSenderId: z.number().int().positive().optional(),
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

const CampaignSchema = z
  .object({
    sender_id: z.number().int().positive(),
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

function defaultConfig(tenantId: string): MailrelayConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    enabled: true,
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

async function authenticatedClient(): Promise<{
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
  const { client, credentials } = await authenticatedClient();
  await ensureMailrelayEventSubscription({ credentials, client });
}

function resourceSegments(event: APIGatewayProxyEventV2WithJWTAuthorizer): string[] {
  const path = event.rawPath ?? event.requestContext.http.path ?? "";
  const segments = path.split("/").filter(Boolean);
  const index = segments.lastIndexOf("email-marketing");
  return index >= 0 ? segments.slice(index + 1) : segments;
}

async function handleCampaignRoutes(
  method: string,
  segments: string[],
  tenantId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2 | null> {
  if (segments[0] !== "campaigns") return null;
  const id = positiveId(segments[1]);
  const { client } = await authenticatedClient();

  if (method === "GET" && !id) {
    const page = await client.page<Record<string, unknown>>("/campaigns", {
      page: event.queryStringParameters?.page ?? "1",
      per_page: event.queryStringParameters?.per_page ?? "100",
    });
    return ok({ campaigns: page.items, pagination: page });
  }
  if (method === "POST" && !id) {
    const body = CampaignSchema.parse(parseJsonBody(event));
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
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2 | null> {
  if (segments[0] !== "sent-campaigns" || method !== "GET") return null;
  const { client } = await authenticatedClient();
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

    if (segments[0] === "credentials" && method === "GET") {
      const credentials = await getMailrelayCredentials(ENVIRONMENT);
      return ok({ credentials: maskMailrelayCredentials(credentials) });
    }

    if (segments[0] === "test" && method === "POST") {
      const { client, credentials } = await authenticatedClient();
      const ping = await client.ping();
      await registerPlatformSubscription();
      return ok({ success: true, ping, credentials: maskMailrelayCredentials(credentials) });
    }

    if (segments[0] === "config") {
      if (method === "GET") {
        const config = (await getMailrelayConfig(auth.tenantId)) ?? defaultConfig(auth.tenantId);
        return ok({ config });
      }
      if (method === "PUT") {
        const body = ConfigSchema.parse(parseJsonBody(event));
        const config = await saveMailrelayConfig(auth.tenantId, {
          enabled: body.enabled,
          defaultGroupIds: body.defaultGroupIds,
          tagGroupMappings: body.tagGroupMappings,
          eventTypes: configuredMailrelayEventTypes(),
          ...(body.defaultSenderId !== undefined
            ? { defaultSenderId: body.defaultSenderId }
            : {}),
        });
        return ok({ config });
      }
    }

    if (segments[0] === "groups" && method === "GET") {
      const { client } = await authenticatedClient();
      const groups = await client.all<MailrelayGroup>("/groups");
      return ok({ groups });
    }

    if (segments[0] === "senders" && method === "GET") {
      const { client } = await authenticatedClient();
      const senders = await client.all<MailrelaySender>("/senders");
      return ok({ senders });
    }

    if (segments[0] === "sync" && method === "POST") {
      await authenticatedClient();
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

    const campaignResult = await handleCampaignRoutes(
      method,
      segments,
      auth.tenantId,
      event
    );
    if (campaignResult) return campaignResult;
    const sentCampaignResult = await handleSentCampaignRoutes(
      method,
      segments,
      auth.tenantId,
      event
    );
    if (sentCampaignResult) return sentCampaignResult;
    return badRequest("Not found");
  } catch (error) {
    return handleError(error);
  }
}
