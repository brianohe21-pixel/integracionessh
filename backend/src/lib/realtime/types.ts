import type { Conversation, Message } from "../../types/index.js";

export type RealtimeEvent =
  | {
      type: "message.created";
      conversationId: string;
      message: Message;
      conversation: Conversation;
    }
  | { type: "conversation.updated"; conversation: Conversation }
  | { type: "conversation.handoff"; conversation: Conversation };

export interface RealtimeConnection {
  connectionId: string;
  tenantId: string;
  userId: string;
  role: string;
  advisorId?: string;
  connectedAt: string;
}
