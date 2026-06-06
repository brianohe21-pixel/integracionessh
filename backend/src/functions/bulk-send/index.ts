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
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertBulkRecipients } from "../../lib/billing/assert-plan.js";
import { incrementBulkRecipients } from "../../lib/dynamodb/usage.repository.js";
import { checkMarketingRecipients } from "../../lib/compliance/recipient-policy.js";
import { ok, created, badRequest, notFound, unprocessableEntity, handleError } from "../../lib/http.js";
import type { BulkSendSQSBody } from "../../types/index.js";

const sqs = new SQSClient({});
const BULK_QUEUE_URL = process.env.BULK_SQS_QUEUE_URL ?? "";
const MAX_RECIPIENTS = 5000;
const SQS_BATCH_SIZE = 10;

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

const CreateBulkSendSchema = z.object({
  botId: z.string().min(1),
  templateName: z.string().min(1),
  language: z.string().min(2).max(10),
  recipients: z.array(RecipientSchema).min(1).max(MAX_RECIPIENTS),
});

async function enqueueRecipients(
  jobId: string,
  tenantId: string,
  botId: string,
  templateName: string,
  language: string,
  recipients: z.infer<typeof CreateBulkSendSchema>["recipients"]
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
          const body: BulkSendSQSBody = {
            jobId,
            tenantId,
            botId,
            templateName,
            language,
            to: recipient.to.replace(/\D/g, ""),
          };
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
    const auth = extractAuthContext(event);
    assertMemberRole(auth);
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

      const { botId, templateName, language, recipients } = parsed.data;

      const bot = await getBot(auth.tenantId, botId);
      if (!bot) return notFound("Bot not found");

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertBulkRecipients(tenant, recipients.length);

      const phones = recipients.map((r) => r.to.replace(/\D/g, ""));
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
      const filteredRecipients = recipients.filter((r) =>
        allowedSet.has(r.to.replace(/\D/g, ""))
      );
      if (filteredRecipients.length === 0) {
        return unprocessableEntity("No recipients eligible for marketing send", { blocked });
      }

      const newJobId = randomUUID();
      const now = new Date().toISOString();

      await createBulkJob({
        jobId: newJobId,
        tenantId: auth.tenantId,
        botId,
        templateName,
        language,
        status: "queued",
        total: filteredRecipients.length,
        createdAt: now,
        updatedAt: now,
      });

      await enqueueRecipients(
        newJobId,
        auth.tenantId,
        botId,
        templateName,
        language,
        filteredRecipients
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
