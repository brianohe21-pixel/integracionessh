import type { CallRecord, Message } from "../../types/index.js";
import { getConversationMessages } from "../dynamodb/conversation.repository.js";

const CALL_WINDOW_BUFFER_MS = 5000;
const TRANSCRIPT_FETCH_LIMIT = 200;

export function resolveCallTimeWindow(call: CallRecord): { start: string; end: string } | null {
  const startMs = Date.parse(call.startedAt ?? call.createdAt);
  if (Number.isNaN(startMs)) return null;

  let endMs: number;
  if (call.endedAt) {
    endMs = Date.parse(call.endedAt);
  } else if (call.duration && call.duration > 0) {
    endMs = startMs + call.duration * 1000;
  } else if (
    call.status === "initiated" ||
    call.status === "ringing" ||
    call.status === "accepted"
  ) {
    endMs = Date.now() + CALL_WINDOW_BUFFER_MS;
  } else {
    endMs = Date.parse(call.updatedAt);
  }

  if (Number.isNaN(endMs)) endMs = startMs;

  return {
    start: new Date(startMs - CALL_WINDOW_BUFFER_MS).toISOString(),
    end: new Date(endMs + CALL_WINDOW_BUFFER_MS).toISOString(),
  };
}

export function messageBelongsToCall(message: Message, call: CallRecord): boolean {
  if (message.role !== "user" && message.role !== "assistant") return false;
  if (message.source === "panel") return false;
  if (message.channel && message.channel !== "phone" && message.channel !== "voicebot") {
    return false;
  }

  if (message.callId) {
    return message.callId === call.callId;
  }

  const externalId = message.externalMessageId ?? "";
  if (externalId.includes(call.callId)) return true;

  const window = resolveCallTimeWindow(call);
  if (!window) return false;

  return message.timestamp >= window.start && message.timestamp <= window.end;
}

export function filterMessagesForCall(messages: Message[], call: CallRecord): Message[] {
  return messages
    .filter((message) => messageBelongsToCall(message, call))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function getCallTranscriptMessages(
  tenantId: string,
  call: CallRecord
): Promise<Message[]> {
  if (!call.conversationId) return [];

  const messages = await getConversationMessages(
    tenantId,
    call.conversationId,
    TRANSCRIPT_FETCH_LIMIT
  );
  return filterMessagesForCall(messages, call);
}
