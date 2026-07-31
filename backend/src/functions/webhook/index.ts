import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { validateWebhookSignature } from "../../lib/whatsapp/client.js";
import { isProcessableInboundMessage } from "../../lib/whatsapp/inbound.js";
import { normalizeWhatsAppContact } from "../../lib/whatsapp/contact.js";
import { isProcessableInstagramMessage } from "../../lib/instagram/inbound.js";
import { isProcessableMessengerMessage } from "../../lib/messenger/inbound.js";
import { getBotByPhoneNumberId } from "../../lib/dynamodb/bot.repository.js";
import { getBotByInstagramPageId, getBotByMessengerPageId } from "../../lib/dynamodb/bot-lookup.repository.js";
import {
  getMessageTracking,
  deleteMessageTracking,
  parseDeliveryFailureError,
  recordBulkDeliveryFailure,
} from "../../lib/dynamodb/bulk-job.repository.js";
import { incrementCampaignAnalytics } from "../../lib/dynamodb/campaign.repository.js";
import {
  isCallStatusItem,
  normalizeCallConnectEvent,
  normalizeCallStatusEvent,
  normalizeCallTerminateEvent,
} from "../../lib/whatsapp/call-events.js";
import type {
  InboundQueueMessage,
  InstagramWebhookEvent,
  WhatsAppWebhookEvent,
} from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";
const CALL_QUEUE_URL = process.env.CALL_EVENTS_QUEUE_URL ?? "";
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

  let payload: { object: string; entry: unknown[] };
  try {
    payload = JSON.parse(rawBody) as { object: string; entry: unknown[] };
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (payload.object === "instagram") {
    await handleInstagramWebhook(payload as InstagramWebhookEvent);
    return { statusCode: 200, body: "OK" };
  }

  if (payload.object === "page") {
    await handleMessengerWebhook(payload as InstagramWebhookEvent);
    return { statusCode: 200, body: "OK" };
  }

  if (payload.object !== "whatsapp_business_account") {
    return { statusCode: 200, body: "OK" };
  }

  await handleWhatsAppWebhook(payload as WhatsAppWebhookEvent);
  return { statusCode: 200, body: "OK" };
}

async function handleInstagramWebhook(payload: InstagramWebhookEvent): Promise<void> {
  const sqsPromises: Promise<unknown>[] = [];

  for (const entry of payload.entry) {
    for (const event of entry.messaging ?? []) {
      const message = event.message;
      if (!message || !isProcessableInstagramMessage(message)) continue;

      const pageId = event.recipient.id;
      const senderId = event.sender.id;
      const lookup = await getBotByInstagramPageId(pageId);
      if (!lookup) {
        console.log(`No bot for Instagram pageId: ${pageId}`);
        continue;
      }

      const { getBot } = await import("../../lib/dynamodb/bot.repository.js");
      const botRecord = await getBot(lookup.tenantId, lookup.botId);
      if (!botRecord || botRecord.status !== "active") continue;

      const conversationKey = `${lookup.tenantId}-${lookup.botId}-ig-${senderId}`;
      const sqsBody: InboundQueueMessage = {
        channel: "instagram",
        tenantId: lookup.tenantId,
        botId: lookup.botId,
        participantId: senderId,
        conversationKey,
        replyToExternalId: message.mid,
        payload: {
          pageId,
          senderId,
          message,
        },
      };

      sqsPromises.push(
        sqs.send(
          new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(sqsBody),
            MessageGroupId: conversationKey,
            MessageDeduplicationId: message.mid,
          })
        )
      );
    }
  }

  await Promise.all(sqsPromises);
}

async function handleMessengerWebhook(payload: InstagramWebhookEvent): Promise<void> {
  const sqsPromises: Promise<unknown>[] = [];

  for (const entry of payload.entry) {
    const pageId = entry.id;

    for (const event of entry.messaging ?? []) {
      const message = event.message;
      if (!message) continue;
      if (message.is_echo) continue;
      if (event.sender.id === pageId) continue;

      const senderId = event.sender.id;
      const messengerPayload = {
        pageId,
        senderId,
        message,
      };
      if (!isProcessableMessengerMessage(messengerPayload)) continue;

      const lookup = await getBotByMessengerPageId(pageId);
      if (!lookup) {
        console.log(`No bot for Messenger pageId: ${pageId}`);
        continue;
      }

      const { getBot } = await import("../../lib/dynamodb/bot.repository.js");
      const botRecord = await getBot(lookup.tenantId, lookup.botId);
      if (!botRecord || botRecord.status !== "active") continue;

      const conversationKey = `${lookup.tenantId}-${lookup.botId}-msg-${senderId}`;
      const sqsBody: InboundQueueMessage = {
        channel: "messenger",
        tenantId: lookup.tenantId,
        botId: lookup.botId,
        participantId: senderId,
        conversationKey,
        replyToExternalId: message.mid,
        payload: messengerPayload,
      };

      sqsPromises.push(
        sqs.send(
          new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(sqsBody),
            MessageGroupId: conversationKey,
            MessageDeduplicationId: message.mid,
          })
        )
      );
    }
  }

  await Promise.all(sqsPromises);
}

async function handleWhatsAppWebhook(payload: WhatsAppWebhookEvent): Promise<void> {
  const sqsPromises: Promise<unknown>[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field === "calls") {
        if (!CALL_QUEUE_URL) continue;

        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;
        const bot = await getBotByPhoneNumberId(phoneNumberId);
        if (!bot || bot.status !== "active") {
          console.log(`No active bot found for calls phoneNumberId: ${phoneNumberId}`);
          continue;
        }

        const ctx = { tenantId: bot.tenantId, botId: bot.botId, phoneNumberId };

        for (const call of value.calls ?? []) {
          if (call.event === "connect") {
            sqsPromises.push(
              sqs.send(
                new SendMessageCommand({
                  QueueUrl: CALL_QUEUE_URL,
                  MessageBody: JSON.stringify(normalizeCallConnectEvent(call, ctx)),
                  MessageGroupId: `${bot.tenantId}-${call.id}`,
                  MessageDeduplicationId: `connect-${call.id}-${call.timestamp}`,
                })
              )
            );
          } else if (call.event === "terminate") {
            sqsPromises.push(
              sqs.send(
                new SendMessageCommand({
                  QueueUrl: CALL_QUEUE_URL,
                  MessageBody: JSON.stringify(normalizeCallTerminateEvent(call, ctx)),
                  MessageGroupId: `${bot.tenantId}-${call.id}`,
                  MessageDeduplicationId: `terminate-${call.id}-${call.timestamp}`,
                })
              )
            );
          }
        }

        for (const status of value.statuses ?? []) {
          if (!isCallStatusItem(status)) continue;
          sqsPromises.push(
            sqs.send(
              new SendMessageCommand({
                QueueUrl: CALL_QUEUE_URL,
                MessageBody: JSON.stringify(normalizeCallStatusEvent(status, ctx)),
                MessageGroupId: `${bot.tenantId}-${status.id}`,
                MessageDeduplicationId: `status-${status.id}-${status.timestamp}`,
              })
            )
          );
        }

        continue;
      }

      if (change.field !== "messages") continue;

      const value = change.value;
      const phoneNumberId = value.metadata.phone_number_id;

      const statuses = value.statuses ?? [];
      for (const status of statuses) {
        if (isCallStatusItem(status)) continue;
        if (status.status === "sent") continue;

        sqsPromises.push(
          (async () => {
            try {
              const tracking = await getMessageTracking(status.id);
              if (!tracking) return;

              const isCampaign = tracking.kind === "campaign" && Boolean(tracking.campaignId);
              const campaignId = isCampaign ? tracking.campaignId : undefined;

              if (status.status === "delivered") {
                if (isCampaign && campaignId) {
                  await incrementCampaignAnalytics(tracking.tenantId, campaignId, "deliveredCount");
                }
                return;
              }

              if (status.status === "read") {
                if (isCampaign && campaignId) {
                  await incrementCampaignAnalytics(tracking.tenantId, campaignId, "readCount");
                }
                return;
              }

              if (status.status === "failed") {
                const parsedError = parseDeliveryFailureError(status.errors);
                if (isCampaign && campaignId) {
                  await Promise.all([
                    incrementCampaignAnalytics(tracking.tenantId, campaignId, "deliveryFailed"),
                    deleteMessageTracking(status.id),
                  ]);
                } else if (tracking.jobId) {
                  await Promise.all([
                    recordBulkDeliveryFailure(tracking.tenantId, tracking.jobId, {
                      to: tracking.to ?? status.recipient_id,
                      messageId: status.id,
                      ...parsedError,
                    }),
                    deleteMessageTracking(status.id),
                  ]);
                }
              }
            } catch (err) {
              console.error(`Failed to process delivery status for messageId=${status.id}:`, err);
            }
          })()
        );
      }

      const messages = value.messages ?? [];
      const contacts = value.contacts ?? [];

      for (const message of messages) {
        if (!isProcessableInboundMessage(message)) continue;

        const contact = normalizeWhatsAppContact(
          contacts.find((c) => c.wa_id === message.from) ?? { wa_id: message.from }
        );

        const bot = await getBotByPhoneNumberId(phoneNumberId);
        if (!bot || bot.status !== "active") {
          console.log(`No active bot found for phoneNumberId: ${phoneNumberId}`);
          continue;
        }

        const conversationKey = `${bot.tenantId}-${bot.botId}-${message.from}`;
        const sqsBody: InboundQueueMessage = {
          channel: "whatsapp",
          tenantId: bot.tenantId,
          botId: bot.botId,
          participantId: message.from,
          conversationKey,
          displayName: contact.profile?.name,
          replyToExternalId: message.id,
          payload: {
            phoneNumberId,
            message,
            contact,
          },
        };

        sqsPromises.push(
          sqs.send(
            new SendMessageCommand({
              QueueUrl: QUEUE_URL,
              MessageBody: JSON.stringify(sqsBody),
              MessageGroupId: conversationKey,
              MessageDeduplicationId: message.id,
            })
          )
        );
      }
    }
  }

  await Promise.all(sqsPromises);
}
