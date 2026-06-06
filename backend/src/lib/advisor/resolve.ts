import { randomUUID } from "crypto";
import {
  addMessage,
  clearConversationHandoff,
  getConversation,
  updateConversation,
} from "../dynamodb/conversation.repository.js";
import type { Conversation, Message } from "../../types/index.js";

export async function resolveConversation(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  csatScore?: number;
  releaseToBot?: boolean;
}): Promise<Conversation | null> {
  const existing = await getConversation(
    params.tenantId,
    params.botId,
    params.conversationId
  );
  if (!existing) return null;

  const now = new Date().toISOString();

  if (params.releaseToBot) {
    await clearConversationHandoff(params.tenantId, params.botId, params.conversationId);
  }

  const patch: Parameters<typeof updateConversation>[3] = {
    workflowStatus: "resolved",
    status: "closed",
    resolvedAt: now,
    ...(params.csatScore !== undefined
      ? { csatScore: params.csatScore, csatSubmittedAt: now }
      : {}),
  };

  const updated = await updateConversation(
    params.tenantId,
    params.botId,
    params.conversationId,
    patch
  );

  const systemMessage: Message = {
    messageId: `sys-${randomUUID()}`,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role: "system",
    content: params.csatScore
      ? `Conversation resolved (CSAT ${params.csatScore}/5)`
      : "Conversation resolved",
    timestamp: now,
  };

  await addMessage(systemMessage, params.botId);

  return updated;
}
