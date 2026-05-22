import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  createBulkJob,
  getBulkJob,
  updateBulkJobStatus,
} from "../../lib/dynamodb/bulk-job.repository.js";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { ok, created, badRequest, notFound, handleError } from "../../lib/http.js";
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
    const method = event.requestContext.http.method;
    const jobId = event.pathParameters?.jobId;

    if (method === "GET" && jobId) {
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

      const newJobId = randomUUID();
      const now = new Date().toISOString();

      await createBulkJob({
        jobId: newJobId,
        tenantId: auth.tenantId,
        botId,
        templateName,
        language,
        status: "queued",
        total: recipients.length,
        createdAt: now,
        updatedAt: now,
      });

      await enqueueRecipients(
        newJobId,
        auth.tenantId,
        botId,
        templateName,
        language,
        recipients
      );

      await updateBulkJobStatus(auth.tenantId, newJobId, "processing");

      const job = await getBulkJob(auth.tenantId, newJobId);
      return created(job);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
