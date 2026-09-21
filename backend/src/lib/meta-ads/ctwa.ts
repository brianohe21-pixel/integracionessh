import { updateConversation } from "../dynamodb/conversation.repository.js";
import {
  attributionFromWhatsAppReferral,
  isAdReferral,
} from "./attribution.js";
import {
  buildCtwaFlowResponseId,
  createLeadFromAds,
} from "./ads-lead.js";
import type { Conversation, WhatsAppInboundPayload, WhatsAppMessage } from "../../types/index.js";

export function extractWhatsAppReferral(message: WhatsAppMessage) {
  return message.referral;
}

export async function handleCtwaAttribution(params: {
  tenantId: string;
  botId: string;
  conversation: Conversation;
  message: WhatsAppMessage;
  participantId: string;
  displayName?: string;
}): Promise<Conversation> {
  const referral = extractWhatsAppReferral(params.message);
  if (!isAdReferral(referral) || !referral) {
    return params.conversation;
  }

  const attribution = attributionFromWhatsAppReferral(referral);
  let conversation = params.conversation;

  if (!conversation.attribution) {
    const updated = await updateConversation(
      params.tenantId,
      params.botId,
      conversation.conversationId,
      { attribution }
    );
    if (updated) conversation = updated;
  }

  await createLeadFromAds({
    tenantId: params.tenantId,
    botId: params.botId,
    phone: params.participantId,
    metaFlowId: "meta_ctwa",
    flowResponseId: buildCtwaFlowResponseId(params.message.id),
    conversationId: conversation.conversationId,
    ...(params.displayName ? { name: params.displayName } : {}),
    attribution,
  }).catch((err) => console.warn("Failed to create CTWA lead:", err));

  return conversation;
}

export function buildCtwaMessageMetadata(message: WhatsAppMessage): Record<string, unknown> | undefined {
  const referral = extractWhatsAppReferral(message);
  if (!isAdReferral(referral) || !referral) return undefined;
  return { referral };
}

export function isCtwaPayload(payload: WhatsAppInboundPayload): boolean {
  return isAdReferral(payload.message.referral);
}
