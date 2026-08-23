import { randomUUID } from "crypto";
import {
  getContactByPhone,
  normalizePhone,
  updateContact,
  upsertFromConversation,
} from "../dynamodb/contact.repository.js";
import {
  createLead,
  getActiveLeadByPhone,
  updateLead,
} from "../dynamodb/lead.repository.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildLeadCreatedPayload } from "../integrations/payloads.js";
import type { Lead } from "../../types/index.js";
import { upsertContactFromLead } from "./convert.js";

export async function createLeadFromFormData(params: {
  tenantId: string;
  botId: string;
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  sourceId?: string;
}): Promise<Lead> {
  const phone = normalizePhone(params.phone);
  const now = new Date().toISOString();
  const activeLead = await getActiveLeadByPhone(params.tenantId, phone);

  if (activeLead) {
    const updated = await updateLead(params.tenantId, activeLead.leadId, {
      ...(params.name ? { name: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
      ...(params.tags?.length
        ? { tags: [...new Set([...activeLead.tags, ...params.tags])] }
        : {}),
    });
    if (updated) {
      await upsertContactFromLead({
        tenantId: params.tenantId,
        phone,
        botId: params.botId,
        leadId: updated.leadId,
        extraTags: params.tags ?? ["lead"],
        ...(params.name ? { name: params.name } : {}),
        ...(params.email ? { email: params.email } : {}),
      });
      return updated;
    }
  }

  const leadId = randomUUID();
  const lead: Lead = {
    leadId,
    tenantId: params.tenantId,
    botId: params.botId,
    phone,
    conversationId: params.sourceId ?? `form-${leadId}`,
    metaFlowId: "web_form",
    flowResponseId: params.sourceId ?? leadId,
    status: "new",
    tags: params.tags ?? ["lead"],
    createdAt: now,
    updatedAt: now,
    ...(params.name ? { name: params.name } : {}),
    ...(params.email ? { email: params.email } : {}),
  };

  await createLead(lead);
  await upsertContactFromLead({
    tenantId: params.tenantId,
    phone,
    botId: params.botId,
    leadId,
    extraTags: params.tags ?? ["lead"],
    ...(params.name ? { name: params.name } : {}),
    ...(params.email ? { email: params.email } : {}),
  });

  await emitIntegrationEvent(
    params.tenantId,
    "lead.created",
    buildLeadCreatedPayload({
      tenantId: params.tenantId,
      botId: params.botId,
      leadId,
      conversationId: lead.conversationId,
      phone,
      metaFlowId: "web_form",
      ...(params.name ? { name: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
    })
  ).catch((err) => console.error("Failed to emit lead.created:", err));

  return lead;
}

export async function saveContactFromFormData(params: {
  tenantId: string;
  botId?: string;
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
}): Promise<void> {
  const phone = normalizePhone(params.phone);
  const existing = await getContactByPhone(params.tenantId, phone);
  const now = new Date().toISOString();

  if (existing) {
    await updateContact(params.tenantId, phone, {
      lastSeenAt: now,
      ...(params.botId ? { lastBotId: params.botId } : {}),
      ...(params.name ? { displayName: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
      ...(params.tags?.length
        ? { tags: [...new Set([...existing.tags, ...params.tags])] }
        : {}),
    });
    return;
  }

  await upsertFromConversation({
    tenantId: params.tenantId,
    phoneNumber: phone,
    ...(params.botId ? { botId: params.botId } : {}),
    source: "lead_capture",
    tags: params.tags ?? ["form"],
    ...(params.name ? { displayName: params.name } : {}),
    ...(params.email ? { email: params.email } : {}),
  });
}
