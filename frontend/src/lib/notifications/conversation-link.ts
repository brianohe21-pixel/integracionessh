import type { Conversation } from "@/types";

export function conversationHref(
  conversation: Conversation,
  options?: { advisorMode?: boolean }
): string {
  const base = options?.advisorMode ? "/inbox" : "/conversations";
  return `${base}?botId=${encodeURIComponent(conversation.botId)}&phone=${encodeURIComponent(conversation.phoneNumber)}`;
}

export function conversationLabel(conversation: Conversation): string {
  return conversation.contactName ?? conversation.phoneNumber ?? conversation.conversationId;
}
