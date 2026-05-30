import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { z } from "zod";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaignStatus,
  updateCampaignDraft,
  saveRecipients,
  listPendingRecipients,
  makeCampaignId,
  type PendingRecipient,
} from "../../lib/dynamodb/campaign.repository.js";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { ok, created, badRequest, notFound, forbidden, handleError } from "../../lib/http.js";
import type { CampaignSQSBody, CampaignRecipient as CampaignRecipientType } from "../../types/index.js";

const sqs = new SQSClient({});
const scheduler = new SchedulerClient({});

const CAMPAIGN_QUEUE_URL = process.env.CAMPAIGN_SQS_QUEUE_URL ?? "";
const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const CAMPAIGNS_FUNCTION_ARN = process.env.CAMPAIGNS_FUNCTION_ARN ?? "";

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

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  botId: z.string().min(1),
  templateName: z.string().min(1),
  language: z.string().min(2).max(10),
  segments: z.array(z.string().max(50)).max(20).default([]),
  scheduledAt: z.string().datetime().optional(),
  recipients: z.array(RecipientSchema).min(1).max(5000),
});

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  segments: z.array(z.string().max(50)).max(20).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

async function enqueueRecipients(
  campaignId: string,
  tenantId: string,
  botId: string,
  templateName: string,
  language: string,
  recipients: PendingRecipient[]
): Promise<void> {
  const BATCH_SIZE = 10;
  let entryIndex = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: CAMPAIGN_QUEUE_URL,
        Entries: batch.map((r) => {
          const body: CampaignSQSBody = {
            campaignId,
            tenantId,
            botId,
            templateName,
            language,
            to: r.to.replace(/\D/g, ""),
          };
          if (r.components?.length) {
            body.components = r.components as NonNullable<CampaignSQSBody["components"]>;
          }
          const dedupId = `${campaignId}-${entryIndex}`;
          entryIndex++;
          return {
            Id: dedupId.slice(0, 80),
            MessageBody: JSON.stringify(body),
            MessageGroupId: campaignId,
            MessageDeduplicationId: dedupId.slice(0, 128),
          };
        }),
      })
    );
  }
}

async function createSchedule(
  campaignId: string,
  tenantId: string,
  scheduledAt: string
): Promise<void> {
  if (!SCHEDULER_ROLE_ARN || !CAMPAIGNS_FUNCTION_ARN) return;

  const scheduleTime = new Date(scheduledAt);
  const scheduleExpression = `at(${scheduleTime.toISOString().slice(0, 19)})`;

  await scheduler.send(
    new CreateScheduleCommand({
      Name: `campaign-${campaignId}`,
      GroupName: `chatbot-platform-${ENVIRONMENT}`,
      ScheduleExpression: scheduleExpression,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: CAMPAIGNS_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          action: "start-scheduled",
          campaignId,
          tenantId,
        }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );
}

async function deleteSchedule(campaignId: string): Promise<void> {
  if (!SCHEDULER_ROLE_ARN) return;
  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        Name: `campaign-${campaignId}`,
        GroupName: `chatbot-platform-${ENVIRONMENT}`,
      })
    );
  } catch {
    // Schedule may not exist
  }
}

async function startCampaign(
  tenantId: string,
  campaignId: string,
  botId: string,
  templateName: string,
  language: string
): Promise<void> {
  const now = new Date().toISOString();
  const pending = await listPendingRecipients(tenantId, campaignId, 5000);
  await enqueueRecipients(campaignId, tenantId, botId, templateName, language, pending);
  await updateCampaignStatus(tenantId, campaignId, "running", { startedAt: now });
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer & {
    action?: string;
    campaignId?: string;
    tenantId?: string;
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
      await startCampaign(tenantId, campaignId, bot.botId, campaign.templateName, campaign.language);
      return ok({ message: "Campaign started." });
    }

    const auth = extractAuthContext(event);
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
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      return ok(campaign);
    }

    if (method === "POST" && !campaignId) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateCampaignSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { name, botId, templateName, language, segments, scheduledAt, recipients } = parsed.data;

      const bot = await getBot(auth.tenantId, botId);
      if (!bot) return notFound("Bot not found");

      const newCampaignId = makeCampaignId();
      const now = new Date().toISOString();
      const status = scheduledAt ? "scheduled" : "draft";

      const campaign = await createCampaign({
        campaignId: newCampaignId,
        tenantId: auth.tenantId,
        botId,
        name,
        templateName,
        language,
        status,
        segments,
        ...(scheduledAt ? { scheduledAt } : {}),
        total: recipients.length,
        createdAt: now,
        updatedAt: now,
      });

      await saveRecipients(
        auth.tenantId,
        newCampaignId,
        recipients as CampaignRecipientType[]
      );

      if (scheduledAt) {
        await createSchedule(newCampaignId, auth.tenantId, scheduledAt);
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

      const patch: { name?: string; segments?: string[]; scheduledAt?: string | null } = {};
      if (parsed.data.name !== undefined) patch.name = parsed.data.name;
      if (parsed.data.segments !== undefined) patch.segments = parsed.data.segments;
      if (parsed.data.scheduledAt !== undefined) patch.scheduledAt = parsed.data.scheduledAt;

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

      await deleteSchedule(campaignId);
      await startCampaign(
        auth.tenantId,
        campaignId,
        campaign.botId,
        campaign.templateName,
        campaign.language
      );
      const updated = await getCampaign(auth.tenantId, campaignId);
      return ok(updated);
    }

    if (method === "POST" && campaignId && action === "pause") {
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      if (campaign.status !== "running") {
        return badRequest("Only running campaigns can be paused");
      }
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

      const pending = await listPendingRecipients(auth.tenantId, campaignId, 5000);
      if (pending.length > 0) {
        await enqueueRecipients(
          campaignId,
          auth.tenantId,
          campaign.botId,
          campaign.templateName,
          campaign.language,
          pending
        );
      }
      await updateCampaignStatus(auth.tenantId, campaignId, "running");
      const updated = await getCampaign(auth.tenantId, campaignId);
      return ok(updated);
    }

    if (method === "DELETE" && campaignId) {
      const campaign = await getCampaign(auth.tenantId, campaignId);
      if (!campaign) return notFound("Campaign not found");
      if (campaign.status === "completed") {
        return badRequest("Completed campaigns cannot be cancelled");
      }
      await deleteSchedule(campaignId);
      await updateCampaignStatus(auth.tenantId, campaignId, "cancelled");
      return ok({ message: "Campaign cancelled" });
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
