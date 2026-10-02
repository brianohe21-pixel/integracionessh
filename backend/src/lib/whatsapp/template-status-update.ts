import { getBotByWabaId } from "../dynamodb/bot-lookup.repository.js";
import { getCachedTemplate, upsertCachedTemplate } from "../dynamodb/template.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  sendTemplateApprovedEmail,
  sendTemplateRejectedEmail,
  sendTemplateStatusChangedEmail,
} from "../email/template-status-notify.js";
import type { WhatsAppTemplate } from "../../types/index.js";

export type MessageTemplateStatusUpdateValue = {
  event?: string;
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string | null;
  message_template_category?: string;
  rejection_info?: {
    reason?: string;
    recommendation?: string;
  };
};

export type TemplateLifecycleStatus = WhatsAppTemplate["status"];

export function mapTemplateStatusEvent(
  event: string
): TemplateLifecycleStatus | null {
  const normalized = event.trim().toUpperCase();
  if (normalized === "APPROVED" || normalized === "REINSTATED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (
    normalized === "PENDING" ||
    normalized === "IN_APPEAL" ||
    normalized === "PAUSED" ||
    normalized === "DISABLED" ||
    normalized === "FLAGGED" ||
    normalized === "LOCKED" ||
    normalized === "ARCHIVED" ||
    normalized === "DELETED" ||
    normalized === "PENDING_DELETION" ||
    normalized === "LIMIT_EXCEEDED"
  ) {
    return "PENDING";
  }
  return null;
}

function normalizeCategory(
  category: string | undefined,
  fallback: WhatsAppTemplate["category"] = "UTILITY"
): WhatsAppTemplate["category"] {
  const value = String(category ?? fallback).toUpperCase();
  if (value === "MARKETING" || value === "AUTHENTICATION" || value === "UTILITY") {
    return value;
  }
  return fallback;
}

function rejectionReasonText(value: MessageTemplateStatusUpdateValue): string | undefined {
  const parts = [
    value.reason && value.reason !== "NONE" ? String(value.reason) : null,
    value.rejection_info?.reason?.trim() || null,
    value.rejection_info?.recommendation?.trim()
      ? `Recomendación: ${value.rejection_info.recommendation.trim()}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : undefined;
}

export async function processMessageTemplateStatusUpdate(
  wabaId: string,
  value: MessageTemplateStatusUpdateValue
): Promise<void> {
  const event = String(value.event ?? "").trim().toUpperCase();
  const name = String(value.message_template_name ?? "").trim();
  const language = String(value.message_template_language ?? "").trim();
  const metaTemplateId = value.message_template_id != null
    ? String(value.message_template_id)
    : undefined;

  if (!event || !name || !language) {
    console.warn("Ignoring incomplete message_template_status_update", {
      wabaId,
      event,
      name,
      language,
    });
    return;
  }

  const mappedStatus = mapTemplateStatusEvent(event);
  if (!mappedStatus) {
    console.log("Ignoring unsupported template status event", { wabaId, event, name, language });
    return;
  }

  const lookup = await getBotByWabaId(wabaId);
  if (!lookup) {
    console.log(`No bot for WABA template status update: ${wabaId}`);
    return;
  }

  const existing = await getCachedTemplate(lookup.tenantId, lookup.botId, name, language);
  const now = new Date().toISOString();
  const category = normalizeCategory(value.message_template_category, existing?.category);
  const resolvedMetaTemplateId = metaTemplateId ?? existing?.metaTemplateId;

  const template: WhatsAppTemplate = {
    templateId: existing?.templateId ?? metaTemplateId ?? `${name}-${language}`,
    tenantId: lookup.tenantId,
    botId: lookup.botId,
    channel: "whatsapp",
    name,
    language,
    category,
    status: mappedStatus,
    components: existing?.components ?? [],
    ...(resolvedMetaTemplateId ? { metaTemplateId: resolvedMetaTemplateId } : {}),
    syncedAt: now,
    createdAt: existing?.createdAt ?? now,
  };

  await upsertCachedTemplate(lookup.tenantId, lookup.botId, template);

  if (existing?.status === mappedStatus) {
    return;
  }

  const tenant = await getTenant(lookup.tenantId);
  const to = tenant?.email?.trim();
  if (!to || !tenant) {
    console.warn("No tenant email for template status notification", {
      tenantId: lookup.tenantId,
      name,
      event,
    });
    return;
  }

  const baseParams = {
    to,
    tenantName: tenant.name,
    templateName: name,
    language,
    category,
  };
  const reason = rejectionReasonText(value);

  try {
    if (mappedStatus === "APPROVED") {
      await sendTemplateApprovedEmail(baseParams);
      return;
    }
    if (event === "REJECTED") {
      await sendTemplateRejectedEmail({
        ...baseParams,
        ...(reason ? { reason } : {}),
      });
      return;
    }
    await sendTemplateStatusChangedEmail({
      ...baseParams,
      status: mappedStatus,
      event,
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    console.error("Failed to send template status notification email:", error);
  }
}
