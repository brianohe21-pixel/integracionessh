import type { Conversation, Message } from "@/types";

export type RealtimeEvent =
  | {
      type: "message.created";
      conversationId: string;
      message: Message;
      conversation: Conversation;
    }
  | {
      type: "message.reaction.updated";
      conversationId: string;
      message: Message;
    }
  | { type: "conversation.updated"; conversation: Conversation }
  | { type: "conversation.handoff"; conversation: Conversation };

export function parseRealtimeEvent(raw: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as RealtimeEvent;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
