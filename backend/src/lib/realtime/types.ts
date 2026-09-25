import type { Conversation, Message, OpsAlert } from "../../types/index.js";

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
  | { type: "conversation.handoff"; conversation: Conversation }
  | {
      type: "task.reminder";
      taskId: string;
      title: string;
      body: string;
      href: string;
      createdAt: string;
      advisorId?: string;
      userIds?: string[];
    }
  | {
      type: "ops.alert";
      alert: OpsAlert;
    };

export interface RealtimeConnection {
  connectionId: string;
  tenantId: string;
  userId: string;
  role: string;
  advisorId?: string;
  connectedAt: string;
}
