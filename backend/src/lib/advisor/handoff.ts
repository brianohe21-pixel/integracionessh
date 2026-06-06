import { randomUUID } from "crypto";
import {
  addMessage,
  clearConversationHandoff,
  getConversation,
  updateConversation,
} from "../dynamodb/conversation.repository.js";
import { getAdvisor, touchAdvisorAssignment } from "../dynamodb/advisor.repository.js";
import { pickAdvisor } from "./pick.js";
import type { Conversation, HandoffReason, Message } from "../../types/index.js";

export async function performHandoff(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  advisorId?: string;
  reason: HandoffReason;
}): Promise<Conversation | null> {
  const existing = await getConversation(params.tenantId, params.botId, params.conversationId);
  if (!existing) return null;

  let advisorId = params.advisorId;
  if (advisorId) {
    const advisor = await getAdvisor(params.tenantId, advisorId);
    if (!advisor || advisor.status !== "active") {
      throw new Error("Advisor not found or inactive");
    }
    await touchAdvisorAssignment(params.tenantId, advisorId);
  } else {
    const picked = await pickAdvisor(params.tenantId, params.botId);
    if (!picked) {
      throw new Error("No active advisors available for this bot");
    }
    advisorId = picked.advisorId;
  }

  const now = new Date().toISOString();

  const updated = await updateConversation(
    params.tenantId,
    params.botId,
    params.conversationId,
    {
      handoffMode: "human",
      assignedAdvisorId: advisorId,
      handoffAt: now,
      handoffReason: params.reason,
    }
  );

  const systemMessage: Message = {
    messageId: `sys-${randomUUID()}`,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role: "system",
    content: `Conversation transferred to advisor (${params.reason})`,
    timestamp: now,
  };

  await addMessage(systemMessage, params.botId);

  return updated;
}

export async function releaseToBot(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
}): Promise<Conversation | null> {
  const existing = await getConversation(params.tenantId, params.botId, params.conversationId);
  if (!existing) return null;

  const now = new Date().toISOString();

  const updated = await clearConversationHandoff(
    params.tenantId,
    params.botId,
    params.conversationId
  );

  const systemMessage: Message = {
    messageId: `sys-${randomUUID()}`,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role: "system",
    content: "Conversation returned to automated bot",
    timestamp: now,
  };

  await addMessage(systemMessage, params.botId);

  return updated;
}
