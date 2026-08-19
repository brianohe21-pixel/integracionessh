import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import type { MailrelayCampaignMetrics, MailrelayEvent } from "../../types/index.js";

const WebhookSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    event_id: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    event: z.string().optional(),
    event_type: z.string().optional(),
    created_at: z.string().optional(),
    occurred_at: z.string().optional(),
  })
  .passthrough();

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function positiveInteger(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function stringValue(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

export function verifyMailrelayWebhookToken(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function parseMailrelayWebhook(
  tenantId: string,
  input: unknown
): MailrelayEvent {
  const payload = WebhookSchema.parse(input);
  const subscriber = objectValue(payload.subscriber);
  const campaign = objectValue(payload.campaign);
  const sentCampaign = objectValue(payload.sent_campaign);
  const type = stringValue(payload.event_type, payload.type, payload.event) ?? "unknown";
  const email = stringValue(payload.email, subscriber?.email)?.trim().toLowerCase();
  const campaignId = positiveInteger(
    payload.sent_campaign_id,
    payload.campaign_id,
    sentCampaign?.id,
    campaign?.id
  );
  const subscriberId = positiveInteger(payload.subscriber_id, subscriber?.id);
  const canonical = JSON.stringify(payload);
  const eventId =
    stringValue(payload.event_id, payload.id) ??
    createHash("sha256").update(`${tenantId}:${canonical}`).digest("hex");
  return {
    eventId,
    tenantId,
    type,
    occurredAt:
      stringValue(payload.occurred_at, payload.created_at) ?? new Date().toISOString(),
    payload,
    ...(campaignId ? { campaignId } : {}),
    ...(subscriberId ? { subscriberId } : {}),
    ...(email ? { email } : {}),
  };
}

export function metricForMailrelayEvent(
  type: string
): keyof Pick<
  MailrelayCampaignMetrics,
  "sent" | "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed" | "complained"
> | null {
  const normalized = type.trim().toLowerCase().replace(/[.\s-]+/g, "_");
  if (normalized.includes("unsubscribe")) return "unsubscribed";
  if (normalized.includes("complaint") || normalized.includes("spam")) return "complained";
  if (normalized.includes("bounce")) return "bounced";
  if (normalized.includes("click")) return "clicked";
  if (normalized.includes("open") || normalized.includes("impression")) return "opened";
  if (normalized.includes("deliver")) return "delivered";
  if (normalized.includes("sent")) return "sent";
  return null;
}

export function isMailrelaySuppressionEvent(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return (
    normalized.includes("unsubscribe") ||
    normalized.includes("bounce") ||
    normalized.includes("complaint") ||
    normalized.includes("spam") ||
    normalized.includes("ban")
  );
}
