import type { CallEvent, CallRecord, Message } from "../../types/index.js";

export type PublicVoiceCallDirection = "inbound" | "outbound";

export interface PublicVoiceCall {
  callId: string;
  botId: string;
  phoneNumber: string;
  businessPhoneNumber?: string;
  direction: PublicVoiceCallDirection;
  status: CallRecord["status"];
  duration?: number;
  startedAt?: string;
  endedAt?: string;
  recordingStatus?: CallRecord["recordingStatus"];
  recordingDurationSeconds?: number;
  structuredOutputs?: CallRecord["extractedFields"];
  costStatus?: CallRecord["costStatus"];
  costBreakdown?: CallRecord["costBreakdown"];
  usageMetrics?: CallRecord["usageMetrics"];
  createdAt: string;
  updatedAt: string;
}

export interface PublicVoiceCallEvent {
  eventId: string;
  callId: string;
  type: CallEvent["type"];
  message?: string;
  createdAt: string;
}

export interface PublicVoiceTranscriptMessage {
  messageId: string;
  role: Message["role"];
  content: string;
  timestamp: string;
}

export function toPublicVoiceDirection(
  direction: CallRecord["direction"]
): PublicVoiceCallDirection {
  return direction === "USER_INITIATED" ? "inbound" : "outbound";
}

export function toPublicVoiceCall(record: CallRecord): PublicVoiceCall {
  return {
    callId: record.callId,
    botId: record.botId,
    phoneNumber: record.phoneNumber,
    ...(record.businessPhoneNumber ? { businessPhoneNumber: record.businessPhoneNumber } : {}),
    direction: toPublicVoiceDirection(record.direction),
    status: record.status,
    ...(record.duration !== undefined ? { duration: record.duration } : {}),
    ...(record.startedAt ? { startedAt: record.startedAt } : {}),
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    ...(record.recordingStatus ? { recordingStatus: record.recordingStatus } : {}),
    ...(record.recordingDurationSeconds !== undefined
      ? { recordingDurationSeconds: record.recordingDurationSeconds }
      : {}),
    ...(record.extractedFields ? { structuredOutputs: record.extractedFields } : {}),
    ...(record.costStatus ? { costStatus: record.costStatus } : {}),
    ...(record.costBreakdown ? { costBreakdown: record.costBreakdown } : {}),
    ...(record.usageMetrics ? { usageMetrics: record.usageMetrics } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toPublicVoiceCallEvent(event: CallEvent): PublicVoiceCallEvent {
  return {
    eventId: event.eventId,
    callId: event.callId,
    type: event.type,
    ...(event.message ? { message: event.message } : {}),
    createdAt: event.createdAt,
  };
}

export function toPublicVoiceTranscriptMessage(message: Message): PublicVoiceTranscriptMessage {
  return {
    messageId: message.messageId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  };
}

export function isTelnyxVoiceCall(record: CallRecord, botId: string): boolean {
  return record.botId === botId && record.provider === "telnyx";
}
