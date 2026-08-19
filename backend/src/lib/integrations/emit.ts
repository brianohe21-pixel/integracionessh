import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { getBot } from "../dynamodb/bot.repository.js";
import {
  createIntegrationDelivery,
  getTenantIntegration,
} from "../dynamodb/integration.repository.js";
import { deliverVoiceAgentWebhook } from "../telephony/webhook-delivery.js";
import type { IntegrationEvent, IntegrationEventPayload } from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.INTEGRATION_SQS_QUEUE_URL ?? "";

export async function emitIntegrationEvent(
  tenantId: string,
  event: IntegrationEvent,
  payload: IntegrationEventPayload
): Promise<void> {
  const botId = typeof payload.data.botId === "string" ? payload.data.botId : undefined;

  if (botId) {
    const bot = await getBot(tenantId, botId);
    if (bot) {
      await deliverVoiceAgentWebhook(bot, event, payload).catch(() => undefined);
    }
  }

  if (!QUEUE_URL) return;

  const integration = await getTenantIntegration(tenantId);
  if (!integration?.enabled) return;
  if (!integration.subscribedEvents.includes(event)) return;

  const delivery = await createIntegrationDelivery({
    tenantId,
    event,
    payload: payload as unknown as Record<string, unknown>,
  });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        tenantId,
        deliveryId: delivery.deliveryId,
        event,
        payload,
        attempt: 1,
        createdAt: delivery.createdAt,
      }),
      MessageGroupId: tenantId,
      MessageDeduplicationId: `${event}-${delivery.deliveryId}-${randomUUID()}`,
    })
  );
}
