import { getLeadByFlowResponseId } from "../dynamodb/lead.repository.js";
import { createLeadFromFormData } from "../leads/form-lead.js";
import type { AdsAttribution, Lead } from "../../types/index.js";

export async function createLeadFromAds(params: {
  tenantId: string;
  botId: string;
  phone: string;
  metaFlowId: "meta_ctwa" | "meta_lead_ads";
  flowResponseId: string;
  conversationId?: string;
  name?: string;
  email?: string;
  notes?: string;
  attribution: AdsAttribution;
  tags?: string[];
}): Promise<Lead | null> {
  const existing = await getLeadByFlowResponseId(params.tenantId, params.flowResponseId);
  if (existing) return existing;

  const tags = [...new Set([...(params.tags ?? []), "meta_ads", params.metaFlowId === "meta_ctwa" ? "ctwa" : "lead_ads"])];

  const lead = await createLeadFromFormData({
    tenantId: params.tenantId,
    botId: params.botId,
    phone: params.phone,
    ...(params.name ? { name: params.name } : {}),
    ...(params.email ? { email: params.email } : {}),
    tags,
    sourceId: params.flowResponseId,
    ...(params.conversationId ? { linkConversationId: params.conversationId } : {}),
    metaFlowId: params.metaFlowId,
    attribution: params.attribution,
    ...(params.notes ? { notes: params.notes } : {}),
  });

  return lead;
}

export function buildCtwaFlowResponseId(messageId: string): string {
  return `ctwa-${messageId}`;
}

export function buildLeadAdsFlowResponseId(leadgenId: string): string {
  return `leadads-${leadgenId}`;
}

export function placeholderPhoneForLeadAds(leadgenId: string): string {
  const suffix = leadgenId.replace(/\D/g, "").slice(-10).padStart(10, "0");
  return `+57000${suffix}`;
}

export function extractLeadAdsFieldValues(
  fieldData: Array<{ name: string; values: string[] }>
): { phone?: string; name?: string; email?: string; notes: string[] } {
  const notes: string[] = [];
  let phone: string | undefined;
  let name: string | undefined;
  let email: string | undefined;

  for (const field of fieldData) {
    const value = field.values.find((entry) => entry.trim())?.trim();
    if (!value) continue;

    const key = field.name.toLowerCase();
    if (key.includes("phone") || key.includes("tel") || key.includes("celular") || key.includes("movil")) {
      phone = value;
      continue;
    }
    if (key.includes("email") || key.includes("correo")) {
      email = value;
      continue;
    }
    if (
      key.includes("full_name") ||
      key.includes("nombre") ||
      key === "name" ||
      key.includes("first_name")
    ) {
      name = name ? `${name} ${value}` : value;
      continue;
    }
    notes.push(`${field.name}: ${value}`);
  }

  return {
    ...(phone ? { phone } : {}),
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    notes,
  };
}
