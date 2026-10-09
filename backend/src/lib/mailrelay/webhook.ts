import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import type {
  MailrelayBounceKind,
  MailrelayCampaignMetrics,
  MailrelayEvent,
} from "../../types/index.js";

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
  const bounceKind = bounceKindForMailrelayEvent(type, payload);
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
    ...(bounceKind ? { bounceKind } : {}),
  };
}

export type MailrelayMetricField = keyof Pick<
  MailrelayCampaignMetrics,
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "hardBounced"
  | "softBounced"
  | "unsubscribed"
  | "complained"
>;

function normalizeMailrelayToken(value: string): string {
  return value.trim().toLowerCase().replace(/[.\s-]+/g, "_");
}

function explicitBounceKind(token: string): "hard" | "soft" | null {
  const candidate = token.includes("bounce") ? token : `${token}_bounce`;
  if (!candidate.includes("bounce")) return null;
  if (
    candidate.includes("soft_bounce") ||
    candidate.includes("softbounce") ||
    /(^|_)soft($|_)/.test(candidate)
  ) {
    return "soft";
  }
  if (
    candidate.includes("hard_bounce") ||
    candidate.includes("hardbounce") ||
    /(^|_)hard($|_)/.test(candidate)
  ) {
    return "hard";
  }
  return null;
}

function typeIndicatesBounce(type: string): boolean {
  return normalizeMailrelayToken(type).includes("bounce");
}

function bounceKindFromPayload(payload: Record<string, unknown> | undefined): MailrelayBounceKind | null {
  if (!payload) return null;
  const candidates = [
    payload.bounce_type,
    payload.bounceType,
    payload.bounce_kind,
    payload.bounceKind,
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const token = normalizeMailrelayToken(value);
    const explicit = explicitBounceKind(token);
    if (explicit) return explicit;
    if (token === "generic" || token === "unknown" || token === "unspecified") return "generic";
  }
  const nested = objectValue(payload.bounce);
  if (nested && nested !== payload) return bounceKindFromPayload(nested);
  return null;
}

export function bounceKindForMailrelayEvent(
  type: string,
  payload?: Record<string, unknown>
): MailrelayBounceKind | null {
  const explicit = explicitBounceKind(normalizeMailrelayToken(type));
  if (explicit) return explicit;
  const fromPayload = bounceKindFromPayload(payload);
  if (fromPayload) return fromPayload;
  if (typeIndicatesBounce(type)) return "generic";
  return null;
}

export function bounceKindForStoredMailrelayEvent(event: {
  type: string;
  bounceKind?: string;
}): MailrelayBounceKind | null {
  if (event.bounceKind === "hard" || event.bounceKind === "soft" || event.bounceKind === "generic") {
    return event.bounceKind;
  }
  const explicit = explicitBounceKind(normalizeMailrelayToken(event.type));
  if (explicit) return explicit;
  if (typeIndicatesBounce(event.type)) return "generic";
  return null;
}

export function metricForMailrelayEvent(type: string): MailrelayMetricField | null {
  const normalized = normalizeMailrelayToken(type);
  if (normalized.includes("unsubscribe")) return "unsubscribed";
  if (normalized.includes("complaint") || normalized.includes("spam")) return "complained";
  const bounceKind = explicitBounceKind(normalized);
  if (bounceKind === "hard") return "hardBounced";
  if (bounceKind === "soft") return "softBounced";
  if (normalized.includes("bounce")) return "bounced";
  if (normalized.includes("click")) return "clicked";
  if (normalized.includes("open") || normalized.includes("impression")) return "opened";
  if (normalized.includes("deliver")) return "delivered";
  if (normalized.includes("sent")) return "sent";
  return null;
}

export function metricFieldsForMailrelayEvent(
  type: string,
  payload?: Record<string, unknown>,
  bounceKind?: MailrelayBounceKind
): MailrelayMetricField[] {
  const kind = bounceKind ?? bounceKindForMailrelayEvent(type, payload);
  if (kind === "hard") return ["hardBounced", "bounced"];
  if (kind === "soft") return ["softBounced", "bounced"];
  if (kind === "generic") return ["bounced"];
  const metric = metricForMailrelayEvent(type);
  return metric ? [metric] : [];
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
