import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getCampaign } from "../../lib/dynamodb/campaign.repository.js";
import {
  createBulkJob,
  getBulkJob,
  listBulkJobs,
  listBulkSendFailures,
  updateBulkJobStatus,
} from "../../lib/dynamodb/bulk-job.repository.js";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertBulkRecipients } from "../../lib/billing/assert-plan.js";
import { incrementBulkRecipients } from "../../lib/dynamodb/usage.repository.js";
import { checkMarketingRecipients } from "../../lib/compliance/recipient-policy.js";
import { evaluateLaw2300ForTenant } from "../../lib/compliance/law2300-tenant.js";
import { normalizePhoneWithCountryCode } from "../../lib/phone/normalize.js";
import { ok, created, badRequest, notFound, unprocessableEntity, handleError } from "../../lib/http.js";
import type { BulkSendSQSBody } from "../../types/index.js";

const sqs = new SQSClient({});
const BULK_QUEUE_URL = process.env.BULK_SQS_QUEUE_URL ?? "";
const MAX_RECIPIENTS = 50_000;
const SQS_BATCH_SIZE = 10;
const SMS_FREE_TEXT_MAX = 1600;

const RecipientSchema = z.object({
  to: z.string().min(10),
  text: z.string().min(1).max(SMS_FREE_TEXT_MAX).optional(),
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

const CreateBulkSendSchema = z
  .object({
    botId: z.string().min(1),
    channel: z.enum(["whatsapp", "sms"]).optional().default("whatsapp"),
    templateName: z.string().min(1).optional(),
    language: z.string().min(2).max(10).optional(),
    text: z.string().min(1).max(SMS_FREE_TEXT_MAX).optional(),
    recipients: z.array(RecipientSchema).min(1).max(MAX_RECIPIENTS),
    requireOptIn: z.boolean().optional().default(true),
    requestDlr: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const hasTemplate = Boolean(data.templateName?.trim() && data.language?.trim());
    const rootText = data.text?.trim() ?? "";
    const recipientTexts = data.recipients.map((r) => r.text?.trim() ?? "");
    const anyRecipientText = recipientTexts.some((t) => t.length > 0);
    const allRecipientText = recipientTexts.every((t) => t.length > 0);
    const hasFreeText = rootText.length > 0 || anyRecipientText;

    if (data.channel === "whatsapp") {
      if (!hasTemplate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WhatsApp bulk send requires templateName and language",
          path: ["templateName"],
        });
      }
      if (hasFreeText) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free-text bulk send is only allowed for SMS",
          path: ["text"],
        });
      }
      return;
    }

    if (hasTemplate && hasFreeText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a template or free text for SMS, not both",
        path: ["text"],
      });
      return;
    }

    if (!hasTemplate && !hasFreeText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMS bulk send requires a template or free text",
        path: ["text"],
      });
      return;
    }

    if (!hasTemplate && anyRecipientText && !allRecipientText && !rootText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each recipient must include text, or provide a shared text field",
        path: ["recipients"],
      });
    }
  });

type CreateBulkSendInput = z.infer<typeof CreateBulkSendSchema>;

function resolveRecipientText(
  recipient: CreateBulkSendInput["recipients"][number],
  sharedText: string | undefined
): string | undefined {
  const perRecipient = recipient.text?.trim();
  if (perRecipient) return perRecipient;
  const shared = sharedText?.trim();
  return shared || undefined;
}

async function enqueueRecipients(
  jobId: string,
  tenantId: string,
  botId: string,
  channel: "whatsapp" | "sms",
  templateName: string | undefined,
  language: string | undefined,
  sharedText: string | undefined,
  recipients: CreateBulkSendInput["recipients"],
  requireOptIn: boolean,
  requestDlr: boolean | undefined
): Promise<void> {
  const batches: typeof recipients[] = [];
  for (let i = 0; i < recipients.length; i += SQS_BATCH_SIZE) {
    batches.push(recipients.slice(i, i + SQS_BATCH_SIZE));
  }

  let entryIndex = 0;
  for (const batch of batches) {
    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: BULK_QUEUE_URL,
        Entries: batch.map((recipient) => {
          const freeText = resolveRecipientText(recipient, sharedText);
          const body: BulkSendSQSBody = {
            jobId,
            tenantId,
            botId,
            channel,
            to: normalizePhoneWithCountryCode(recipient.to),
            requireOptIn,
            outboundKind: "marketing",
          };
          if (freeText) {
            body.text = freeText;
            if (requestDlr !== undefined) body.requestDlr = requestDlr;
          } else {
            body.templateName = templateName ?? "";
            body.language = language ?? "";
          }
          if (recipient.components?.length) {
            body.components = recipient.components as NonNullable<BulkSendSQSBody["components"]>;
          }
          const dedupId = `${jobId}-${entryIndex}`;
          entryIndex++;
          return {
            Id: dedupId.slice(0, 80),
            MessageBody: JSON.stringify(body),
            MessageGroupId: jobId,
            MessageDeduplicationId: dedupId.slice(0, 128),
          };
        }),
      })
    );
  }
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "bulkSend");
    const method = event.requestContext.http.method;
    const jobId = event.pathParameters?.jobId;

    if (method === "GET" && !jobId) {
      const jobs = await listBulkJobs(auth.tenantId);
      return ok(jobs);
    }

    if (method === "GET" && jobId) {
      const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
      if (rawPath.endsWith("/failures")) {
        const job = await getBulkJob(auth.tenantId, jobId);
        if (!job) {
          const campaign = await getCampaign(auth.tenantId, jobId);
          if (!campaign) return notFound("Job not found");
        }
        const limit = Math.min(
          Math.max(parseInt(event.queryStringParameters?.limit ?? "500", 10) || 500, 1),
          1000
        );
        const failures = await listBulkSendFailures(auth.tenantId, jobId, limit);
        return ok(failures);
      }

      const job = await getBulkJob(auth.tenantId, jobId);
      if (!job) return notFound("Job not found");
      return ok(job);
    }

    if (method === "POST" && !jobId) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateBulkSendSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { botId, channel, templateName, language, text, recipients, requireOptIn, requestDlr } =
        parsed.data;
      const isFreeText =
        channel === "sms" &&
        (Boolean(text?.trim()) || recipients.some((r) => Boolean(r.text?.trim())));

      const bot = await getBot(auth.tenantId, botId);
      if (!bot) return notFound("Bot not found");
      if (channel === "sms" && !bot.smsEnabled) {
        return badRequest("SMS is not enabled for this bot");
      }

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertBulkRecipients(tenant, recipients.length);

      let filteredRecipients = recipients;
      if (requireOptIn) {
        const phones = recipients.map((r) => normalizePhoneWithCountryCode(r.to));
        const { allowed, blocked } = await checkMarketingRecipients(
          auth.tenantId,
          phones,
          auth.userId
        );
        if (blocked.length > 0) {
          return unprocessableEntity("Some recipients cannot receive marketing messages", {
            blocked,
          });
        }
        const allowedSet = new Set(allowed);
        filteredRecipients = recipients.filter((r) =>
          allowedSet.has(normalizePhoneWithCountryCode(r.to))
        );
        if (filteredRecipients.length === 0) {
          return unprocessableEntity("No recipients eligible for marketing send", { blocked });
        }
      }

      const law2300 = await evaluateLaw2300ForTenant(auth.tenantId);
      if (!law2300.allowed) {
        return unprocessableEntity("Sending blocked by Colombian Law 2300 schedule", {
          reason: law2300.reason,
          nextWindowAt: law2300.nextWindowAt?.toISOString(),
        });
      }

      const newJobId = randomUUID();
      const now = new Date().toISOString();

      await createBulkJob({
        jobId: newJobId,
        tenantId: auth.tenantId,
        botId,
        channel,
        templateName: isFreeText ? "(custom)" : (templateName ?? ""),
        language: isFreeText ? "und" : (language ?? ""),
        messageMode: isFreeText ? "free_text" : "template",
        status: "queued",
        total: filteredRecipients.length,
        createdAt: now,
        updatedAt: now,
      });

      await enqueueRecipients(
        newJobId,
        auth.tenantId,
        botId,
        channel,
        templateName,
        language,
        text,
        filteredRecipients,
        requireOptIn,
        isFreeText ? (requestDlr ?? true) : requestDlr
      );

      await updateBulkJobStatus(auth.tenantId, newJobId, "processing");
      await incrementBulkRecipients(auth.tenantId, filteredRecipients.length);

      const job = await getBulkJob(auth.tenantId, newJobId);
      return created(job);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
