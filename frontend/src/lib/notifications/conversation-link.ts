import type { Conversation } from "@/types";

export function conversationHref(conversation: Conversation): string {
  return `/conversations?botId=${encodeURIComponent(conversation.botId)}&phone=${encodeURIComponent(conversation.phoneNumber)}`;
}

export function conversationLabel(conversation: Conversation): string {
  return conversation.contactName ?? conversation.phoneNumber ?? conversation.conversationId;
}
