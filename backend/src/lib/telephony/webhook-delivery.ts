import { createHmac } from "crypto";
import { assertSafeUrl } from "../webhook/client.js";
import type { Bot, IntegrationEvent, IntegrationEventPayload } from "../../types/index.js";
import {
  createVoiceAgentWebhookDelivery,
  updateVoiceAgentWebhookDeliveryStatus,
} from "../dynamodb/voice-agent-webhook.repository.js";

const TIMEOUT_MS = 10_000;

function buildSignature(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverVoiceAgentWebhook(
  bot: Bot,
  event: IntegrationEvent,
  payload: IntegrationEventPayload
): Promise<void> {
  if (!bot.telephonyWebhookEnabled || !bot.telephonyWebhookUrl) return;
  const subscribed = bot.telephonyWebhookEvents ?? [];
  if (!subscribed.includes(event)) return;

  await assertSafeUrl(bot.telephonyWebhookUrl);

  const delivery = await createVoiceAgentWebhookDelivery({
    tenantId: bot.tenantId,
    botId: bot.botId,
    event,
    payload: payload as unknown as Record<string, unknown>,
  });

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "IntegracionesSSH/1.0",
    "X-Integration-Event": event,
    "X-Voice-Agent-Id": bot.botId,
  };

  if (bot.telephonyWebhookSecret) {
    headers["X-Integration-Signature"] = buildSignature(bot.telephonyWebhookSecret, body);
  }

  try {
    const response = await fetch(bot.telephonyWebhookUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    await updateVoiceAgentWebhookDeliveryStatus(
      bot.tenantId,
      bot.botId,
      delivery.deliveryId,
      delivery.createdAt,
      response.ok ? "delivered" : "failed",
      response.ok ? undefined : `HTTP ${response.status}`
    );
  } catch (error) {
    await updateVoiceAgentWebhookDeliveryStatus(
      bot.tenantId,
      bot.botId,
      delivery.deliveryId,
      delivery.createdAt,
      "failed",
      error instanceof Error ? error.message : "Delivery failed"
    );
  }
}
