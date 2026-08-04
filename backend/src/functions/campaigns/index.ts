import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaignStatus,
  updateCampaignDraft,
  saveRecipients,
  makeCampaignId,
  incrementCampaignBatchVersion,
  listPendingRecipients,
} from "../../lib/dynamodb/campaign.repository.js";
import { listBulkSendFailures } from "../../lib/dynamodb/bulk-job.repository.js";
import { getCampaignMetrics } from "../../lib/dynamodb/campaign-metrics.repository.js";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertBulkRecipients, assertCanStartCampaign } from "../../lib/billing/assert-plan.js";
import { incrementBulkRecipients, incrementCampaignsStarted } from "../../lib/dynamodb/usage.repository.js";
import { listContactsByTags } from "../../lib/dynamodb/contact.repository.js";
import { checkMarketingRecipients } from "../../lib/compliance/recipient-policy.js";
import { getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import { assertWhatsAppQualityForCampaign } from "../../lib/whatsapp/assert-campaign-quality.js";
import { ok, created, badRequest, notFound, forbidden, unprocessableEntity, handleError } from "../../lib/http.js";
import type { CampaignRecipient as CampaignRecipientType } from "../../types/index.js";
import { validateBatchConfig } from "../../lib/campaign/batch.js";
import {
  createCampaignStartSchedule,
  deleteCampaignStartSchedule,
  deleteCampaignBatchSchedule,
} from "../../lib/campaign/scheduler.js";
import { dispatchCampaignBatch, startCampaignDispatch, enqueueRecipients } from "../../lib/campaign/dispatch.js";
import { assertSmsBotReady } from "../../lib/sms/send-outbound.js";
import type { Bot, OutreachChannel } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

async function assertBotReadyForCampaign(
  tenantId: string,
  phoneNumberId: string
): Promise<void> {
  const accessToken = await getWhatsAppAccessToken(tenantId, ENVIRONMENT);
  await assertWhatsAppQualityForCampaign(phoneNumberId, accessToken);
}

async function assertCampaignChannelReady(
  tenantId: string,
  bot: Bot,
  channel: OutreachChannel
): Promise<void> {
  if (channel === "sms") {
    await assertSmsBotReady(bot);
    return;
  }
  await assertBotReadyForCampaign(tenantId, bot.phoneNumberId);
}

const RecipientSchema = z.object({
  to: z.string().min(10),
  components: z
    .array(
      z.object({
        type: z.string(),
        parameters: z
          .array(
            z.object({
              type: z.string(),
              text: z.string().optional(),
              image: z.object({ link: z.string() }).optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

const BatchConfigSchema = z.object({
  size: z.number().int().min(1).max(1000),
  delaySeconds: z.number().int().min(60).max(86_400),
});

const CreateCampaignSchema = z
  .object({
    name: z.string().min(1).max(120),
    botId: z.string().min(1),
    channel: z.enum(["whatsapp", "sms"]).optional().default("whatsapp"),
    templateName: z.string().min(1),
    language: z.string().min(2).max(10),
    segments: z.array(z.string().max(50)).max(20).default([]),
    scheduledAt: z.string().datetime().optional(),
    batchConfig: BatchConfigSchema.optional(),
    recipients: z.array(RecipientSchema).max(5000).optional(),
    audienceTags: z.array(z.string().max(50)).max(20).optional(),
    requireOptIn: z.boolean().optional().default(false),
    requestDlr: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const hasRecipients = (data.recipients?.length ?? 0) > 0;
    const hasTags = (data.audienceTags?.length ?? 0) > 0;
    if (!hasRecipients && !hasTags) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide recipients or audienceTags",
      });
    }
    if (data.batchConfig) {
      const error = validateBatchConfig(data.batchConfig);
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        });
      }
    }
  });

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  segments: z.array(z.string().max(50)).max(20).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  batchConfig: BatchConfigSchema.nullable().optional(),
});

async function startCampaign(
  tenantId: string,
  campaignId: string,
  botId: string,
  templateName: string,
  language: string,
  requireOptIn: boolean,
  actorUserId?: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateCampaignStatus(tenantId, campaignId, "running", { startedAt: now });
  await startCampaignDispatch(
    tenantId,
    campaignId,
    botId,
    templateName,
    language,
    requireOptIn,
    actorUserId
  );
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer & {
    action?: string;
    campaignId?: string;
    tenantId?: string;
    batchVersion?: number;
  }
): Promise<APIGatewayProxyResultV2> {
  try {
    if (event.action === "start-scheduled") {
      const { campaignId, tenantId } = event as { action: string; campaignId: string; tenantId: string };
      const campaign = await getCampaign(tenantId, campaignId);
      if (!campaign || campaign.status !== "scheduled") {
        return ok({ message: "Campaign not in scheduled status, skipping." });
      }
      const bot = await getBot(tenantId, campaign.botId);
      if (!bot) return ok({ message: "Bot not found, skipping." });
      await assertCampaignChannelReady(tenantId, bot, campaign.channel ?? "whatsapp");
      await startCampaign(
        tenantId,
        campaignId,
        bot.botId,
        campaign.templateName,
        campaign.language,
        campaign.requireOptIn ?? false
      );
      return ok({ message: "Campaign started." });
    }

    if (event.action === "dispatch-batch") {
      const { campaignId, tenantId, batchVersion } = event as {
        action: string;
        campaignId: string;
        tenantId: string;
        batchVersion: number;
      };
      const campaign = await getCampaign(tenantId, campaignId);
      if (!campaign || campaign.status !== "running") {
        return ok({ message: "Campaign not running, skipping batch dispatch." });
      }
      await dispatchCampaignBatch(tenantId, campaignId, batchVersion);
      return ok({ message: "Batch dispatched." });
    }

    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const campaignId = event.pathParameters?.campaignId;
    const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
    const pathSegments = rawPath.split("/").filter(Boolean);
    const action = pathSegments[pathSegments.length - 1];

    if (method === "GET" && !campaignId) {
      const campaigns = await listCampaigns(auth.tenantId);
      return ok(campaigns);
    }

    if (method === "GET" && campaignId) {
      if (rawPath.endsWith("/metrics")) {
        const metrics = await getCampaignMetrics(auth.tenantId, campaignId);
        if (!metrics) return notFound("Campaign not found");
        return ok(metrics);
      }

      if (rawPath.endsWith("/failures")) {
        const campaign = await getCampaign(auth.tenantId, campaignId);
        if (!campaign) return notFound("Campaign not found");
        const limit = Math.min(
          Math.max(parseInt(event.queryStringParameters?.limit ?? "500", 10) || 500, 1),
          1000
        );
        const failures = await listBulkSendFailures(auth.tenantId, campaignId, limit);
        return ok(failures);
      }

      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      return ok(campaign);
    }

    if (method === "POST" && !campaignId) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateCampaignSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const {
        name,
        botId,
        channel,
        templateName,
        language,
        segments,
        scheduledAt,
        audienceTags,
        requireOptIn,
        requestDlr,
        batchConfig,
      } = parsed.data;

      let recipients = parsed.data.recipients ?? [];
      if (audienceTags?.length) {
        const contacts = await listContactsByTags(auth.tenantId, audienceTags, { requireOptIn });
        const fromTags = contacts.map((c) => ({ to: c.phoneNumber }));
        recipients = [...recipients, ...fromTags];
      }

      const uniqueRecipients = [
        ...new Map(recipients.map((r) => [r.to.replace(/\D/g, ""), r])).values(),
      ];

      if (uniqueRecipients.length === 0) {
        return badRequest("No eligible contacts found for this audience");
      }

      if (requireOptIn) {
        const phones = uniqueRecipients.map((r) => r.to.replace(/\D/g, ""));
        const { blocked } = await checkMarketingRecipients(auth.tenantId, phones, auth.userId);
        if (blocked.length > 0) {
          return unprocessableEntity("Some recipients cannot receive marketing messages", {
            blocked,
          });
        }
      }

      const mergedSegments = [
        ...new Set([...segments, ...(audienceTags ?? [])]),
      ];

      const bot = await getBot(auth.tenantId, botId);
      if (!bot) return notFound("Bot not found");

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertBulkRecipients(tenant, uniqueRecipients.length);

      const newCampaignId = makeCampaignId();
      const now = new Date().toISOString();
      const status = scheduledAt ? "scheduled" : "draft";

      const campaign = await createCampaign({
        campaignId: newCampaignId,
        tenantId: auth.tenantId,
        botId,
        name,
        channel,
        templateName,
        language,
        status,
        segments: mergedSegments,
        requireOptIn,
        ...(channel === "sms" && requestDlr ? { requestDlr: true } : {}),
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(batchConfig ? { batchConfig } : {}),
        total: uniqueRecipients.length,
        createdAt: now,
        updatedAt: now,
      });

      await saveRecipients(
        auth.tenantId,
        newCampaignId,
        uniqueRecipients as CampaignRecipientType[]
      );

      if (scheduledAt) {
        await createCampaignStartSchedule(newCampaignId, auth.tenantId, scheduledAt);
      }

      return created(campaign);
    }

    if (method === "PUT" && campaignId) {
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      if (campaign.status !== "draft") {
        return forbidden("Only draft campaigns can be edited");
      }
      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateCampaignSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const patch: {
        name?: string;
        segments?: string[];
        scheduledAt?: string | null;
        batchConfig?: { size: number; delaySeconds: number } | null;
      } = {};
      if (parsed.data.name !== undefined) patch.name = parsed.data.name;
      if (parsed.data.segments !== undefined) patch.segments = parsed.data.segments;
      if (parsed.data.scheduledAt !== undefined) patch.scheduledAt = parsed.data.scheduledAt;
      if (parsed.data.batchConfig !== undefined) patch.batchConfig = parsed.data.batchConfig;

      await updateCampaignDraft(auth.tenantId, campaignId, patch);
      const updated = await getCampaign(auth.tenantId, campaignId);
      return ok(updated);
    }

    if (method === "POST" && campaignId && action === "start") {
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      if (campaign.status !== "draft" && campaign.status !== "scheduled") {
        return badRequest("Campaign must be in draft or scheduled status to start");
      }
      const bot = await getBot(auth.tenantId, campaign.botId);
      if (!bot) return notFound("Bot not found");

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertCanStartCampaign(tenant);
      await assertCampaignChannelReady(auth.tenantId, bot, campaign.channel ?? "whatsapp");

      await deleteCampaignStartSchedule(campaignId);
      await deleteCampaignBatchSchedule(campaignId);

      await startCampaign(
        auth.tenantId,
        campaignId,
        campaign.botId,
        campaign.templateName,
        campaign.language,
        campaign.requireOptIn ?? false,
        auth.userId
      );
      await incrementCampaignsStarted(auth.tenantId);
      await incrementBulkRecipients(auth.tenantId, campaign.total);
      const updated = await getCampaign(auth.tenantId, campaignId);
      return ok(updated);
    }

    if (method === "POST" && campaignId && action === "pause") {
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      if (campaign.status !== "running") {
        return badRequest("Only running campaigns can be paused");
      }
      await deleteCampaignBatchSchedule(campaignId);
      await incrementCampaignBatchVersion(auth.tenantId, campaignId);
      await updateCampaignStatus(auth.tenantId, campaignId, "paused");
      const updated = await getCampaign(auth.tenantId, campaignId);
      return ok(updated);
    }

    if (method === "POST" && campaignId && action === "resume") {
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      if (campaign.status !== "paused") {
        return badRequest("Only paused campaigns can be resumed");
      }
      const bot = await getBot(auth.tenantId, campaign.botId);
      if (!bot) return notFound("Bot not found");

      await assertCampaignChannelReady(auth.tenantId, bot, campaign.channel ?? "whatsapp");
      await deleteCampaignBatchSchedule(campaignId);

      if (campaign.batchConfig) {
        await updateCampaignStatus(auth.tenantId, campaignId, "running");
        await dispatchCampaignBatch(
          auth.tenantId,
          campaignId,
          campaign.batchVersion,
          auth.userId
        );
      } else {
        const pending = await listPendingRecipients(auth.tenantId, campaignId, 5000);
        const phones = pending.map((r) => r.to.replace(/\D/g, ""));
        let eligible = pending;
        if (campaign.requireOptIn) {
          const { allowed } = await checkMarketingRecipients(auth.tenantId, phones, auth.userId);
          const allowedSet = new Set(allowed);
          eligible = pending.filter((r) => allowedSet.has(r.to.replace(/\D/g, "")));
        }
        if (eligible.length > 0) {
          await enqueueRecipients(campaign, eligible);
        }
        await updateCampaignStatus(auth.tenantId, campaignId, "running");
      }

      const updated = await getCampaign(auth.tenantId, campaignId);
      return ok(updated);
    }

    if (method === "DELETE" && campaignId) {
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      if (campaign.status === "completed") {
        return badRequest("Completed campaigns cannot be cancelled");
      }
      await deleteCampaignStartSchedule(campaignId);
      await deleteCampaignBatchSchedule(campaignId);
      await incrementCampaignBatchVersion(auth.tenantId, campaignId);
      await updateCampaignStatus(auth.tenantId, campaignId, "cancelled");
      return ok({ message: "Campaign cancelled" });
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
