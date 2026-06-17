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
  getLeadByFlowResponseId,
  getLeadById,
  linkFlowResponseToLead,
  updateLead,
} from "../dynamodb/lead.repository.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import {
  buildLeadConvertedPayload,
  buildLeadCreatedPayload,
} from "../integrations/payloads.js";
import type { Contact, FlowResponse, Lead, MarketingConsent } from "../../types/index.js";

export function isLeadCaptureResponse(responseJson: Record<string, unknown>): boolean {
  const name = responseJson.name;
  const email = responseJson.email;
  return (
    (typeof name === "string" && name.trim().length > 0) ||
    (typeof email === "string" && email.trim().length > 0)
  );
}

function parseLeadFields(responseJson: Record<string, unknown>): {
  name?: string;
  email?: string;
} {
  const name =
    typeof responseJson.name === "string" && responseJson.name.trim()
      ? responseJson.name.trim()
      : undefined;
  const email =
    typeof responseJson.email === "string" && responseJson.email.trim()
      ? responseJson.email.trim()
      : undefined;
  return { ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

function mergeTags(existing: string[], ...add: string[]): string[] {
  return [...new Set([...existing, ...add])];
}

export async function upsertContactFromLead(params: {
  tenantId: string;
  phone: string;
  botId: string;
  name?: string;
  email?: string;
  leadId?: string;
  extraTags?: string[];
}): Promise<Contact> {
  const phone = normalizePhone(params.phone);
  const existing = await getContactByPhone(params.tenantId, phone);
  const now = new Date().toISOString();

  if (existing) {
    const updates: Parameters<typeof updateContact>[2] = {
      lastSeenAt: now,
      lastBotId: params.botId,
    };
    if (params.name && params.name !== existing.displayName) {
      updates.displayName = params.name;
    }
    if (params.email && params.email !== existing.email) {
      updates.email = params.email;
    }
    if (params.leadId) {
      updates.leadId = params.leadId;
    }
    if (params.extraTags?.length) {
      updates.tags = mergeTags(existing.tags, ...params.extraTags);
    }
    return (await updateContact(params.tenantId, phone, updates)) ?? existing;
  }

  const contact = await upsertFromConversation({
    tenantId: params.tenantId,
    phoneNumber: phone,
    botId: params.botId,
    source: "lead_capture",
    tags: params.extraTags ?? ["lead"],
    ...(params.name ? { displayName: params.name } : {}),
    ...(params.email ? { email: params.email } : {}),
    ...(params.leadId ? { leadId: params.leadId } : {}),
  });
  return contact;
}

export async function createLeadFromFlowResponse(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  phone: string;
  metaFlowId: string;
  flowResponseId: string;
  responseJson: Record<string, unknown>;
  createdAt: string;
}): Promise<Lead | null> {
  if (!isLeadCaptureResponse(params.responseJson)) return null;

  const existingByResponse = await getLeadByFlowResponseId(
    params.tenantId,
    params.flowResponseId
  );
  if (existingByResponse) return existingByResponse;

  const { name, email } = parseLeadFields(params.responseJson);
  const now = params.createdAt;
  const activeLead = await getActiveLeadByPhone(params.tenantId, params.phone);

  if (activeLead) {
    const updated = await updateLead(params.tenantId, activeLead.leadId, {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      tags: mergeTags(activeLead.tags, "lead"),
    });
    if (updated) {
      await linkFlowResponseToLead(
        params.tenantId,
        params.flowResponseId,
        params.metaFlowId,
        params.createdAt,
        params.flowResponseId,
        updated.leadId
      );
      await upsertContactFromLead({
        tenantId: params.tenantId,
        phone: params.phone,
        botId: params.botId,
        leadId: updated.leadId,
        extraTags: ["lead"],
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      });
      return updated;
    }
  }

  const leadId = randomUUID();
  const lead: Lead = {
    leadId,
    tenantId: params.tenantId,
    botId: params.botId,
    phone: normalizePhone(params.phone),
    conversationId: params.conversationId,
    metaFlowId: params.metaFlowId,
    flowResponseId: params.flowResponseId,
    status: "new",
    tags: ["lead"],
    createdAt: now,
    updatedAt: now,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  };

  await createLead(lead);
  await linkFlowResponseToLead(
    params.tenantId,
    params.flowResponseId,
    params.metaFlowId,
    params.createdAt,
    params.flowResponseId,
    leadId
  );
  await upsertContactFromLead({
    tenantId: params.tenantId,
    phone: params.phone,
    botId: params.botId,
    leadId,
    extraTags: ["lead"],
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  });

  await emitIntegrationEvent(
    params.tenantId,
    "lead.created",
    buildLeadCreatedPayload({
      tenantId: params.tenantId,
      botId: params.botId,
      leadId,
      conversationId: params.conversationId,
      phone: params.phone,
      metaFlowId: params.metaFlowId,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    })
  ).catch((err) => console.error("Failed to emit lead.created:", err));

  return lead;
}

export async function convertLeadToContact(params: {
  tenantId: string;
  leadId: string;
  marketingConsent?: MarketingConsent;
}): Promise<{ lead: Lead; contact: Contact } | null> {
  const existingLead = await getLeadById(params.tenantId, params.leadId);
  if (!existingLead) return null;

  const lead = await updateLead(params.tenantId, params.leadId, {
    status: "converted",
    convertedAt: new Date().toISOString(),
    tags: mergeTags(existingLead.tags, "converted"),
  });
  if (!lead) return null;

  const existing = await getContactByPhone(params.tenantId, lead.phone);
  const contact = await upsertContactFromLead({
    tenantId: params.tenantId,
    phone: lead.phone,
    botId: lead.botId,
    leadId: lead.leadId,
    extraTags: ["lead", "converted"],
    ...(lead.name ? { name: lead.name } : {}),
    ...(lead.email ? { email: lead.email } : {}),
  });

  if (params.marketingConsent && params.marketingConsent !== existing?.marketingConsent) {
    const now = new Date().toISOString();
    await updateContact(params.tenantId, lead.phone, {
      marketingConsent: params.marketingConsent,
      consentAt: now,
      consentSource: "panel",
    });
  }

  const finalContact = (await getContactByPhone(params.tenantId, lead.phone)) ?? contact;

  await emitIntegrationEvent(
    params.tenantId,
    "lead.converted",
    buildLeadConvertedPayload({
      tenantId: params.tenantId,
      botId: lead.botId,
      leadId: lead.leadId,
      conversationId: lead.conversationId,
      phone: lead.phone,
      contact: finalContact,
    })
  ).catch((err) => console.error("Failed to emit lead.converted:", err));

  return { lead, contact: finalContact };
}

export async function markLeadAsLost(
  tenantId: string,
  leadId: string
): Promise<Lead | null> {
  return updateLead(tenantId, leadId, { status: "lost" });
}

export function flowResponseToLeadFields(response: FlowResponse): {
  name?: string;
  email?: string;
} {
  return parseLeadFields(response.responseJson);
}
