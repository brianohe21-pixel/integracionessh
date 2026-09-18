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
import type { AdsAttribution, Lead } from "../../types/index.js";
import { upsertContactFromLead } from "./convert.js";
import { linkConversationToContact } from "../contacts/link-conversation-to-contact.js";

export async function createLeadFromFormData(params: {
  tenantId: string;
  botId: string;
  phone: string;
  name?: string;
  email?: string;
  notes?: string;
  tags?: string[];
  sourceId?: string;
  linkConversationId?: string;
  metaFlowId?: string;
  attribution?: AdsAttribution;
}): Promise<Lead> {
  const phone = normalizePhone(params.phone);
  const now = new Date().toISOString();
  const activeLead = await getActiveLeadByPhone(params.tenantId, phone);

  if (activeLead) {
    const updated = await updateLead(params.tenantId, activeLead.leadId, {
      ...(params.name ? { name: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
      ...(params.notes ? { notes: params.notes } : {}),
      ...(params.attribution && !activeLead.attribution
        ? { attribution: params.attribution }
        : {}),
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
      if (params.linkConversationId) {
        await linkConversationToContact({
          tenantId: params.tenantId,
          botId: params.botId,
          conversationId: params.linkConversationId,
          phone,
          ...(params.name ? { displayName: params.name } : {}),
          ...(params.email ? { email: params.email } : {}),
        }).catch((err) => console.warn("Failed to link conversation to contact:", err));
      }
      return updated;
    }
  }

  const leadId = randomUUID();
  const metaFlowId = params.metaFlowId ?? "web_form";
  const lead: Lead = {
    leadId,
    tenantId: params.tenantId,
    botId: params.botId,
    phone,
    conversationId: params.linkConversationId ?? params.sourceId ?? `form-${leadId}`,
    metaFlowId,
    flowResponseId: params.sourceId ?? leadId,
    status: "new",
    tags: params.tags ?? ["lead"],
    createdAt: now,
    updatedAt: now,
    ...(params.name ? { name: params.name } : {}),
    ...(params.email ? { email: params.email } : {}),
    ...(params.notes ? { notes: params.notes } : {}),
    ...(params.attribution ? { attribution: params.attribution } : {}),
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
      metaFlowId,
      ...(params.name ? { name: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
      ...(params.attribution ? { attribution: params.attribution } : {}),
    })
  ).catch((err) => console.error("Failed to emit lead.created:", err));

  if (params.linkConversationId) {
    await linkConversationToContact({
      tenantId: params.tenantId,
      botId: params.botId,
      conversationId: params.linkConversationId,
      phone,
      ...(params.name ? { displayName: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
    }).catch((err) => console.warn("Failed to link conversation to contact:", err));
  }

  return lead;
}

export async function saveContactFromFormData(params: {
  tenantId: string;
  botId?: string;
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  linkConversationId?: string;
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
  } else {
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

  if (params.linkConversationId && params.botId) {
    await linkConversationToContact({
      tenantId: params.tenantId,
      botId: params.botId,
      conversationId: params.linkConversationId,
      phone,
      ...(params.name ? { displayName: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
    }).catch((err) => console.warn("Failed to link conversation to contact:", err));
  }
}
