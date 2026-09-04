import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { validateWebhookSignature } from "../../lib/whatsapp/client.js";
import { isProcessableInboundMessage } from "../../lib/whatsapp/inbound.js";
import { normalizeWhatsAppContact } from "../../lib/whatsapp/contact.js";
import { enqueueWhatsAppSync } from "../../lib/whatsapp/coexistence/sync-queue.js";
import { isProcessableInstagramMessage } from "../../lib/instagram/inbound.js";
import { isProcessableMessengerMessage } from "../../lib/messenger/inbound.js";
import { resolveWhatsAppChannelByPhoneNumberId } from "../../lib/whatsapp/channel-context.js";
import { getBotByPhoneNumberId } from "../../lib/dynamodb/bot.repository.js";
import { getBotByInstagramPageId, getBotByMessengerPageId } from "../../lib/dynamodb/bot-lookup.repository.js";
import {
  getMessageTracking,
  deleteMessageTracking,
  parseDeliveryFailureError,
  recordBulkDeliveryFailure,
  recordBulkSendFailure,
} from "../../lib/dynamodb/bulk-job.repository.js";
import { incrementCampaignAnalytics } from "../../lib/dynamodb/campaign.repository.js";
import { applyWhatsAppStatusToAttempt } from "../../lib/dynamodb/campaign-send-attempt.repository.js";
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
import { getMetaAppCredentialForOwner } from "../../lib/integrations/meta-app-credentials.js";
import { getWhatsAppAccountByWabaId } from "../../lib/dynamodb/whatsapp-account.repository.js";

const sqs = new SQSClient({});
const s3 = new S3Client({});
const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";
const CALL_QUEUE_URL = process.env.CALL_EVENTS_QUEUE_URL ?? "";
const WHATSAPP_SYNC_QUEUE_URL = process.env.WHATSAPP_SYNC_QUEUE_URL ?? "";
const MEDIA_BUCKET = process.env.MEDIA_BUCKET ?? "";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

function extractWhatsAppWebhookOwnerId(path: string): string | null {
  const match = path.match(/\/webhook\/whatsapp\/([^/]+)$/);
  return match?.[1] ?? null;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const path = event.rawPath ?? event.requestContext.http.path ?? "";
  const ownerTenantId = extractWhatsAppWebhookOwnerId(path);

  if (ownerTenantId) {
    if (event.requestContext.http.method === "GET") {
      return handleOwnerVerification(event, ownerTenantId);
    }
    return handleOwnerWebhook(event, ownerTenantId);
  }

  if (event.requestContext.http.method === "GET") {
    return handleVerification(event);
  }

  return handleWebhook(event);
}

async function handleOwnerVerification(
  event: APIGatewayProxyEventV2,
  ownerTenantId: string
): Promise<APIGatewayProxyResultV2> {
  const params = event.queryStringParameters ?? {};
  const mode = params["hub.mode"];
  const token = params["hub.verify_token"];
  const challenge = params["hub.challenge"];

  const credential = await getMetaAppCredentialForOwner(ownerTenantId, ENVIRONMENT);
  const verifyToken = credential?.webhookVerifyToken ?? VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("Owner webhook verified successfully", { ownerTenantId });
    return { statusCode: 200, body: challenge };
  }

  console.warn("Owner webhook verification failed", { ownerTenantId, mode, token });
  return { statusCode: 403, body: "Forbidden" };
}

async function assertWebhookOwnerMatchesPayload(
  ownerTenantId: string,
  payload: WhatsAppWebhookEvent
): Promise<boolean> {
  for (const entry of payload.entry) {
    const account = await getWhatsAppAccountByWabaId(entry.id);
    if (!account) continue;
    const expectedOwner = account.metaAppOwnerTenantId ?? "platform";
    if (expectedOwner !== ownerTenantId) {
      console.warn("Webhook owner mismatch", {
        ownerTenantId,
        expectedOwner,
        wabaId: entry.id,
      });
      return false;
    }
    return true;
  }
  return true;
}

async function handleOwnerWebhook(
  event: APIGatewayProxyEventV2,
  ownerTenantId: string
): Promise<APIGatewayProxyResultV2> {
  const rawBody = event.body ?? "";
  const signature = event.headers["x-hub-signature-256"] ?? "";

  const credential = await getMetaAppCredentialForOwner(ownerTenantId, ENVIRONMENT);
  const appSecret = credential?.appSecret ?? APP_SECRET;

  if (appSecret && !validateWebhookSignature(rawBody, signature, appSecret)) {
    console.warn("Invalid owner webhook signature", { ownerTenantId });
    return { statusCode: 401, body: "Invalid signature" };
  }

  let payload: { object: string; entry: unknown[] };
  try {
    payload = JSON.parse(rawBody) as { object: string; entry: unknown[] };
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (payload.object !== "whatsapp_business_account") {
    return { statusCode: 200, body: "OK" };
  }

  const whatsappPayload = payload as WhatsAppWebhookEvent;
  const ownerMatches = await assertWebhookOwnerMatchesPayload(ownerTenantId, whatsappPayload);
  if (!ownerMatches) {
    return { statusCode: 403, body: "Forbidden" };
  }

  await handleWhatsAppWebhook(whatsappPayload);
  return { statusCode: 200, body: "OK" };
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

async function handleCoexistenceChange(
  wabaId: string,
  change: WhatsAppWebhookEvent["entry"][number]["changes"][number]
): Promise<void> {
  if (!WHATSAPP_SYNC_QUEUE_URL) {
    console.warn("WHATSAPP_SYNC_QUEUE_URL not configured; skipping coexistence webhook");
    return;
  }

  const value = change.value as unknown as Record<string, unknown>;
  const metadata = value.metadata as
    | { phone_number_id?: string; display_phone_number?: string }
    | undefined;
  const phoneNumberId =
    metadata?.phone_number_id ?? (value.phone_number_id as string | undefined);

  if (change.field === "account_update") {
    await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
      jobType: "account_update",
      dedupeKey: `account-update-${wabaId}-${Date.now()}`,
      payload: {
        wabaId,
        value,
      },
    });
    return;
  }

  if (change.field === "phone_number_quality_update" && phoneNumberId) {
    await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
      jobType: "phone_quality_update",
      phoneNumberId,
      dedupeKey: `phone-quality-${phoneNumberId}-${Date.now()}`,
      payload: { value },
    });
    return;
  }

  if (change.field === "account_alerts") {
    await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
      jobType: "account_alert",
      dedupeKey: `account-alert-${wabaId}-${Date.now()}`,
      payload: {
        wabaId,
        value,
      },
    });
    return;
  }

  if (!phoneNumberId) return;

  if (change.field === "smb_message_echoes") {
    const echoes = value.message_echoes as unknown[] | undefined;
    if (!echoes?.length) return;
    await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
      jobType: "echo_batch",
      phoneNumberId,
      dedupeKey: `echo-${phoneNumberId}-${echoes[0] && (echoes[0] as { id?: string }).id}`,
      payload: { echoes },
    });
    return;
  }

  if (change.field === "smb_app_state_sync") {
    const stateSync = value.state_sync as unknown[] | undefined;
    if (!stateSync?.length) return;
    await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
      jobType: "contact_batch",
      phoneNumberId,
      dedupeKey: `contacts-${phoneNumberId}-${Date.now()}`,
      payload: { stateSync },
    });
    return;
  }

  if (change.field === "history") {
    const history = value.history as unknown[] | undefined;
    const rawPayload = {
      history,
      metadata,
      businessPhone: metadata?.display_phone_number,
    };
    const serialized = JSON.stringify(rawPayload);
    const chunkMeta = (history?.[0] as { metadata?: { phase?: number; chunk_order?: number; progress?: number } })
      ?.metadata;
    const dedupeKey = `history-${phoneNumberId}-${chunkMeta?.phase ?? 0}-${chunkMeta?.chunk_order ?? 0}`;

    if (serialized.length > 200_000 && MEDIA_BUCKET) {
      const s3Key = `coexistence/webhooks/${phoneNumberId}/${randomUUID()}.json`;
      await s3.send(
        new PutObjectCommand({
          Bucket: MEDIA_BUCKET,
          Key: s3Key,
          Body: serialized,
          ContentType: "application/json",
        })
      );
      await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
        jobType: "history_chunk",
        phoneNumberId,
        s3Key,
        dedupeKey,
        payload: {
          businessPhone: metadata?.display_phone_number,
          progress: chunkMeta?.progress,
          phase: chunkMeta?.phase,
        },
      });
      return;
    }

    await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
      jobType: "history_chunk",
      phoneNumberId,
      dedupeKey,
      payload: rawPayload,
    });
  }
}

async function handleWhatsAppWebhook(payload: WhatsAppWebhookEvent): Promise<void> {
  const sqsPromises: Promise<unknown>[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (
        change.field === "history" ||
        change.field === "smb_app_state_sync" ||
        change.field === "smb_message_echoes" ||
        change.field === "account_update" ||
        change.field === "phone_number_quality_update" ||
        change.field === "account_alerts"
      ) {
        sqsPromises.push(handleCoexistenceChange(entry.id, change));
        continue;
      }

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
                  if (tracking.attemptId) {
                    await applyWhatsAppStatusToAttempt(
                      tracking.tenantId,
                      campaignId,
                      tracking.attemptId,
                      status
                    );
                  }
                }
                return;
              }

              if (status.status === "read") {
                if (isCampaign && campaignId) {
                  await incrementCampaignAnalytics(tracking.tenantId, campaignId, "readCount");
                  if (tracking.attemptId) {
                    await applyWhatsAppStatusToAttempt(
                      tracking.tenantId,
                      campaignId,
                      tracking.attemptId,
                      status
                    );
                  }
                }
                return;
              }

              if (status.status === "failed") {
                const parsedError = parseDeliveryFailureError(status.errors);
                if (isCampaign && campaignId) {
                  await Promise.all([
                    incrementCampaignAnalytics(tracking.tenantId, campaignId, "deliveryFailed"),
                    tracking.attemptId
                      ? applyWhatsAppStatusToAttempt(
                          tracking.tenantId,
                          campaignId,
                          tracking.attemptId,
                          status
                        )
                      : Promise.resolve(),
                    recordBulkSendFailure(tracking.tenantId, campaignId, "delivery", {
                      to: tracking.to ?? status.recipient_id,
                      messageId: status.id,
                      ...(tracking.attemptId ? { attemptId: tracking.attemptId } : {}),
                      ...parsedError,
                    }),
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

        const resolved = await resolveWhatsAppChannelByPhoneNumberId(phoneNumberId);
        const bot = resolved?.bot ?? (await getBotByPhoneNumberId(phoneNumberId));
        if (!bot || bot.status !== "active") {
          console.log(`No active bot found for phoneNumberId: ${phoneNumberId}`);
          continue;
        }

        const conversationKey = resolved
          ? `${bot.tenantId}-${bot.botId}-${phoneNumberId}-${message.from}`
          : `${bot.tenantId}-${bot.botId}-${message.from}`;
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
            ...(resolved?.channel.channelId
              ? { whatsappChannelId: resolved.channel.channelId }
              : {}),
            ...(resolved?.channel.accountId
              ? { whatsappAccountId: resolved.channel.accountId }
              : {}),
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
