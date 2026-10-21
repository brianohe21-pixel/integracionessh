import { getBotByWabaId } from "../dynamodb/bot-lookup.repository.js";
import { getCachedTemplate, upsertCachedTemplate } from "../dynamodb/template.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { sendTemplateQualityChangedEmail } from "../email/template-status-notify.js";
import type { WhatsAppTemplate, WhatsAppTemplateQualityScore } from "../../types/index.js";
import { normalizeTemplateQualityScore } from "./client.js";

export type MessageTemplateQualityUpdateValue = {
  previous_quality_score?: string;
  new_quality_score?: string;
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
};

export function mapTemplateQualityScore(
  score: unknown
): WhatsAppTemplateQualityScore | null {
  return normalizeTemplateQualityScore(score) ?? null;
}

export async function processMessageTemplateQualityUpdate(
  wabaId: string,
  value: MessageTemplateQualityUpdateValue
): Promise<void> {
  const name = String(value.message_template_name ?? "").trim();
  const language = String(value.message_template_language ?? "").trim();
  const previousScore = mapTemplateQualityScore(value.previous_quality_score);
  const newScore = mapTemplateQualityScore(value.new_quality_score);
  const metaTemplateId =
    value.message_template_id != null ? String(value.message_template_id) : undefined;

  if (!name || !language || !newScore) {
    console.warn("Ignoring incomplete message_template_quality_update", {
      wabaId,
      name,
      language,
      newScore,
    });
    return;
  }

  const lookup = await getBotByWabaId(wabaId);
  if (!lookup) {
    console.log(`No bot for WABA template quality update: ${wabaId}`);
    return;
  }

  const existing = await getCachedTemplate(lookup.tenantId, lookup.botId, name, language);
  const now = new Date().toISOString();
  const resolvedMetaTemplateId = metaTemplateId ?? existing?.metaTemplateId;

  const template: WhatsAppTemplate = {
    templateId: existing?.templateId ?? metaTemplateId ?? `${name}-${language}`,
    tenantId: lookup.tenantId,
    botId: lookup.botId,
    channel: "whatsapp",
    name,
    language,
    category: existing?.category ?? "UTILITY",
    status: existing?.status ?? "APPROVED",
    components: existing?.components ?? [],
    qualityScore: newScore,
    ...(resolvedMetaTemplateId ? { metaTemplateId: resolvedMetaTemplateId } : {}),
    syncedAt: now,
    createdAt: existing?.createdAt ?? now,
  };

  await upsertCachedTemplate(lookup.tenantId, lookup.botId, template);

  if (existing?.qualityScore === newScore) {
    return;
  }

  const tenant = await getTenant(lookup.tenantId);
  const to = tenant?.email?.trim();
  if (!to || !tenant) {
    console.warn("No tenant email for template quality notification", {
      tenantId: lookup.tenantId,
      name,
      newScore,
    });
    return;
  }

  try {
    await sendTemplateQualityChangedEmail({
      to,
      tenantName: tenant.name,
      templateName: name,
      language,
      category: template.category,
      previousScore: previousScore ?? existing?.qualityScore ?? "UNKNOWN",
      newScore,
    });
  } catch (error) {
    console.error("Failed to send template quality notification email:", error);
  }
}
