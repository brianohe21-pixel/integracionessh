import { getConversationMessages } from "../dynamodb/conversation.repository.js";
import { listContactConversations } from "./contact-conversation-index.js";
import { resolveContactIdFromConversation } from "./resolve-contact-id.js";
import type { Channel, Conversation, Message } from "../../types/index.js";

export interface CrossChannelMessage extends Message {
  originConversationId: string;
  originChannel: Channel;
  isCurrentConversation: boolean;
}

export async function getCrossChannelHistory(params: {
  tenantId: string;
  conversation: Conversation;
  limit?: number;
}): Promise<CrossChannelMessage[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const contactId =
    params.conversation.contactId ??
    (await resolveContactIdFromConversation(params.tenantId, params.conversation));

  const refs = await listContactConversations(params.tenantId, contactId);
  const otherRefs = refs.filter(
    (ref) => ref.conversationId !== params.conversation.conversationId
  );

  if (otherRefs.length === 0) return [];

  const perConvLimit = Math.max(10, Math.ceil(limit / otherRefs.length));
  const allMessages: CrossChannelMessage[] = [];

  await Promise.all(
    otherRefs.map(async (ref) => {
      const messages = await getConversationMessages(
        params.tenantId,
        ref.conversationId,
        perConvLimit
      );
      for (const msg of messages) {
        allMessages.push({
          ...msg,
          channel: msg.channel ?? ref.channel,
          originConversationId: ref.conversationId,
          originChannel: ref.channel,
          isCurrentConversation: false,
        });
      }
    })
  );

  return allMessages
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit);
}

export async function getContactTimelineMessages(params: {
  tenantId: string;
  conversation: Conversation;
  limit?: number;
}): Promise<Message[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const currentMessages = await getConversationMessages(
    params.tenantId,
    params.conversation.conversationId,
    limit
  );
  const crossChannel = await getCrossChannelHistory({
    tenantId: params.tenantId,
    conversation: params.conversation,
    limit: Math.max(20, Math.floor(limit / 2)),
  });

  const merged = [...crossChannel, ...currentMessages];
  const byId = new Map<string, Message>();
  for (const msg of merged) {
    const existing = byId.get(msg.messageId);
    if (!existing || msg.timestamp >= existing.timestamp) {
      byId.set(msg.messageId, msg);
    }
  }

  return [...byId.values()]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit);
}
