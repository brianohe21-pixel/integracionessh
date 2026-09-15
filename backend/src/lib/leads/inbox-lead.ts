import { randomUUID } from "crypto";
import { normalizePhone } from "../dynamodb/contact.repository.js";
import { linkConversationToContact } from "../contacts/link-conversation-to-contact.js";
import {
  createLead,
  getActiveLeadByPhone,
} from "../dynamodb/lead.repository.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildLeadCreatedPayload } from "../integrations/payloads.js";
import type { Conversation, Lead } from "../../types/index.js";
import { upsertContactFromLead } from "./convert.js";

export function resolveConversationPhone(conversation: Conversation): string | null {
  const channel = conversation.channel ?? "whatsapp";
  if (channel === "email") {
    return conversation.phoneNumber?.trim() ? normalizePhone(conversation.phoneNumber) : null;
  }
  const raw = conversation.phoneNumber || conversation.participantId;
  if (!raw?.trim()) return null;
  const phone = normalizePhone(raw);
  return phone.length >= 10 ? phone : null;
}

export async function createLeadFromInbox(params: {
  tenantId: string;
  botId: string;
  conversation: Conversation;
  name?: string;
  email?: string;
  notes?: string;
  assignedAdvisorId?: string;
}): Promise<Lead> {
  const phone = resolveConversationPhone(params.conversation);
  if (!phone) {
    const error = new Error("Conversation does not have a valid phone number for lead capture");
    (error as Error & { statusCode: number }).statusCode = 400;
    throw error;
  }

  const activeLead = await getActiveLeadByPhone(params.tenantId, phone);
  if (activeLead) {
    const error = new Error("Active lead already exists for this contact");
    (error as Error & { statusCode: number }).statusCode = 409;
    throw error;
  }

  const name =
    params.name?.trim() ||
    params.conversation.contactName?.trim() ||
    undefined;
  const email =
    params.email?.trim() ||
    (params.conversation.channel === "email"
      ? params.conversation.participantId?.trim()
      : undefined);

  const now = new Date().toISOString();
  const leadId = randomUUID();
  const lead: Lead = {
    leadId,
    tenantId: params.tenantId,
    botId: params.botId,
    phone,
    conversationId: params.conversation.conversationId,
    metaFlowId: "inbox",
    flowResponseId: params.conversation.conversationId,
    status: "new",
    tags: ["lead", "inbox"],
    createdAt: now,
    updatedAt: now,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(params.notes ? { notes: params.notes } : {}),
    ...(params.assignedAdvisorId ? { assignedAdvisorId: params.assignedAdvisorId } : {}),
  };

  await createLead(lead);
  await upsertContactFromLead({
    tenantId: params.tenantId,
    phone,
    botId: params.botId,
    leadId,
    extraTags: ["lead", "inbox"],
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  });
  await linkConversationToContact({
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversation.conversationId,
    phone,
    ...(name ? { displayName: name } : {}),
    ...(email ? { email } : {}),
  }).catch((err) => console.warn("Failed to link conversation to contact:", err));

  await emitIntegrationEvent(
    params.tenantId,
    "lead.created",
    buildLeadCreatedPayload({
      tenantId: params.tenantId,
      botId: params.botId,
      leadId,
      conversationId: params.conversation.conversationId,
      phone,
      metaFlowId: "inbox",
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    })
  ).catch((err) => console.error("Failed to emit lead.created:", err));

  return lead;
}
