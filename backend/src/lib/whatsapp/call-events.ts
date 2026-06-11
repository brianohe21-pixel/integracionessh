import type {
  CallQueueMessage,
  WhatsAppCallStatusItem,
  WhatsAppCallWebhookItem,
  WhatsAppStatus,
} from "../../types/index.js";

export function isCallStatusItem(
  status: WhatsAppStatus | WhatsAppCallStatusItem
): status is WhatsAppCallStatusItem {
  return "type" in status && status.type === "call";
}

function resolveSession(call: WhatsAppCallWebhookItem) {
  if (call.session) return call.session;
  const webrtcSdp = call.connection?.webrtc?.sdp;
  if (webrtcSdp) {
    return { sdp_type: "answer" as const, sdp: webrtcSdp };
  }
  return undefined;
}

export function normalizeCallConnectEvent(
  call: WhatsAppCallWebhookItem,
  ctx: { tenantId: string; botId: string; phoneNumberId: string }
): CallQueueMessage {
  const customerPhone =
    call.direction === "BUSINESS_INITIATED" ? (call.to ?? "") : (call.from ?? call.to ?? "");

  const session = resolveSession(call);
  return {
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    phoneNumberId: ctx.phoneNumberId,
    eventType: "connect",
    callId: call.id,
    phoneNumber: customerPhone,
    direction: call.direction ?? "USER_INITIATED",
    timestamp: call.timestamp,
    ...(call.from ? { from: call.from } : {}),
    ...(call.to ? { to: call.to } : {}),
    ...(session ? { session } : {}),
    ...(call.biz_opaque_callback_data
      ? { bizOpaqueCallbackData: call.biz_opaque_callback_data }
      : {}),
  };
}

export function normalizeCallStatusEvent(
  status: WhatsAppCallStatusItem,
  ctx: { tenantId: string; botId: string; phoneNumberId: string }
): CallQueueMessage {
  return {
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    phoneNumberId: ctx.phoneNumberId,
    eventType: "status",
    callId: status.id,
    to: status.recipient_id,
    phoneNumber: status.recipient_id,
    status: status.status,
    timestamp: status.timestamp,
  };
}

export function normalizeCallTerminateEvent(
  call: WhatsAppCallWebhookItem,
  ctx: { tenantId: string; botId: string; phoneNumberId: string }
): CallQueueMessage {
  const rawStatus = call.status;
  const statusValue = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  const mappedStatus =
    statusValue === "Failed"
      ? "FAILED"
      : statusValue === "Completed"
        ? "COMPLETED"
        : undefined;

  return {
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    phoneNumberId: ctx.phoneNumberId,
    eventType: "terminate",
    callId: call.id,
    timestamp: call.timestamp,
    ...(call.direction ? { direction: call.direction } : {}),
    ...(call.from ? { from: call.from } : {}),
    ...(call.to ? { to: call.to } : {}),
    ...(call.duration !== undefined ? { duration: call.duration } : {}),
    ...(call.biz_opaque_callback_data
      ? { bizOpaqueCallbackData: call.biz_opaque_callback_data }
      : {}),
    ...(mappedStatus ? { status: mappedStatus } : {}),
    ...(call.start_time ? { startTime: call.start_time } : {}),
    ...(call.end_time ? { endTime: call.end_time } : {}),
  };
}
