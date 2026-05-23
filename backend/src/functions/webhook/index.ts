import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { validateWebhookSignature } from "../../lib/whatsapp/client.js";
import { getBotByPhoneNumberId } from "../../lib/dynamodb/bot.repository.js";
import {
  getMessageTracking,
  deleteMessageTracking,
  incrementBulkJobDeliveryFailed,
} from "../../lib/dynamodb/bulk-job.repository.js";
import type { WhatsAppWebhookEvent, SQSMessageBody } from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === "GET") {
    return handleVerification(event);
  }

  return handleWebhook(event);
}

function handleVerification(event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 {
  const params = event.queryStringParameters ?? {};
  const mode = params["hub.mode"];
  const token = params["hub.verify_token"];
  const challenge = params["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("Webhook verified successfully");
    return { statusCode: 200, body: challenge };
  }

  console.warn("Webhook verification failed", { mode, token });
  return { statusCode: 403, body: "Forbidden" };
}

async function handleWebhook(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const rawBody = event.body ?? "";
  const signature = event.headers["x-hub-signature-256"] ?? "";

  if (APP_SECRET && !validateWebhookSignature(rawBody, signature, APP_SECRET)) {
    console.warn("Invalid webhook signature");
    return { statusCode: 401, body: "Invalid signature" };
  }

  let payload: WhatsAppWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookEvent;
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (payload.object !== "whatsapp_business_account") {
    return { statusCode: 200, body: "OK" };
  }

  const sqsPromises: Promise<unknown>[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      const phoneNumberId = value.metadata.phone_number_id;

      const statuses = value.statuses ?? [];
      for (const status of statuses) {
        if (status.status !== "failed") continue;
        sqsPromises.push(
          (async () => {
            try {
              const tracking = await getMessageTracking(status.id);
              if (!tracking) return;
              await Promise.all([
                incrementBulkJobDeliveryFailed(tracking.tenantId, tracking.jobId),
                deleteMessageTracking(status.id),
              ]);
              console.log(
                `Delivery failure recorded for job=${tracking.jobId} messageId=${status.id} errors=${JSON.stringify(status.errors ?? [])}`
              );
            } catch (err) {
              console.error(`Failed to process delivery status for messageId=${status.id}:`, err);
            }
          })()
        );
      }

      const messages = value.messages ?? [];
      const contacts = value.contacts ?? [];

      for (const message of messages) {
        if (message.type !== "text" || !message.text?.body) continue;

        const contact =
          contacts.find((c) => c.wa_id === message.from) ?? {
            wa_id: message.from,
            profile: { name: "WhatsApp User" },
          };

        const bot = await getBotByPhoneNumberId(phoneNumberId);
        if (!bot || bot.status !== "active") {
          console.log(`No active bot found for phoneNumberId: ${phoneNumberId}`);
          continue;
        }

        const conversationId = `${bot.tenantId}-${bot.botId}-${message.from}`;

        const sqsBody: SQSMessageBody = {
          tenantId: bot.tenantId,
          botId: bot.botId,
          conversationId,
          phoneNumberId,
          message,
          contact,
        };

        sqsPromises.push(
          sqs.send(
            new SendMessageCommand({
              QueueUrl: QUEUE_URL,
              MessageBody: JSON.stringify(sqsBody),
              MessageGroupId: conversationId,
              MessageDeduplicationId: message.id,
            })
          )
        );
      }
    }
  }

  await Promise.all(sqsPromises);

  return { statusCode: 200, body: "OK" };
}
