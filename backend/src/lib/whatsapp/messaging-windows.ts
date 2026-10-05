import type { Conversation, Message } from "../../types/index.js";

export const FREE_ENTRY_POINT_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FREE_ENTRY_POINT_WINDOW_MS = 72 * 60 * 60 * 1000;
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function shouldOpenFreeEntryPoint(
  conversation: Pick<Conversation, "attribution" | "createdAt" | "freeEntryPointOpenedAt"> | null,
  replyAt: string
): boolean {
  if (!conversation) return false;
  if (conversation.attribution?.source !== "meta_ctwa") return false;
  if (conversation.freeEntryPointOpenedAt) return false;
  const createdMs = new Date(conversation.createdAt).getTime();
  const replyMs = new Date(replyAt).getTime();
  if (!Number.isFinite(createdMs) || !Number.isFinite(replyMs)) return false;
  return replyMs - createdMs <= FREE_ENTRY_POINT_REPLY_WINDOW_MS;
}

export type MessageWindowDirection = "inbound" | "outbound";

export type MessageWindowBucket =
  | "inboundService24h"
  | "outboundService24h"
  | "inboundFreeEntry72h"
  | "outboundFreeEntry72h"
  | "inboundOutsideWindow"
  | "outboundOutsideWindow";

export function isFreeEntryPointWindowOpen(
  conversation: Pick<Conversation, "freeEntryPointOpenedAt"> | null,
  nowMs: number = Date.now()
): boolean {
  if (!conversation?.freeEntryPointOpenedAt || !Number.isFinite(nowMs)) return false;
  const openedMs = Date.parse(conversation.freeEntryPointOpenedAt);
  if (!Number.isFinite(openedMs)) return false;
  const elapsed = nowMs - openedMs;
  return elapsed >= 0 && elapsed <= FREE_ENTRY_POINT_WINDOW_MS;
}

export function resolveWhatsAppMessageWindowDirection(
  message: Pick<Message, "channel" | "source" | "role">
): MessageWindowDirection | null {
  if ((message.channel ?? "whatsapp") !== "whatsapp") return null;
  if (message.source === "whatsapp_history") return null;
  if (message.source === "whatsapp_app_echo") return "outbound";
  if (message.source === "whatsapp_inbound" || message.role === "user") return "inbound";
  if (
    message.role === "advisor" ||
    message.role === "assistant" ||
    message.source === "panel"
  ) {
    return "outbound";
  }
  return null;
}

export function classifyWhatsAppMessageWindow(params: {
  direction: MessageWindowDirection;
  atMs: number;
  conversation: Pick<Conversation, "lastInboundAt" | "freeEntryPointOpenedAt"> | null;
  opensFreeEntryPoint?: boolean;
}): MessageWindowBucket | null {
  if (!Number.isFinite(params.atMs)) return null;

  const freeEntryOpen =
    Boolean(params.opensFreeEntryPoint) ||
    isFreeEntryPointWindowOpen(params.conversation, params.atMs);
  if (freeEntryOpen) {
    return params.direction === "inbound" ? "inboundFreeEntry72h" : "outboundFreeEntry72h";
  }

  const lastInboundAt = params.conversation?.lastInboundAt;
  const serviceOpen = isCustomerServiceWindowOpen(
    {
      channel: "whatsapp",
      ...(lastInboundAt ? { lastInboundAt } : {}),
    },
    params.atMs
  );
  if (serviceOpen || params.direction === "inbound") {
    return params.direction === "inbound" ? "inboundService24h" : "outboundService24h";
  }

  return "outboundOutsideWindow";
}

export function isCustomerServiceWindowOpen(
  conversation: Pick<Conversation, "lastInboundAt" | "channel"> | null,
  nowMs: number = Date.now()
): boolean {
  if (!conversation) return false;
  if ((conversation.channel ?? "whatsapp") !== "whatsapp") return true;
  if (!conversation.lastInboundAt) return false;
  const lastInboundMs = new Date(conversation.lastInboundAt).getTime();
  if (!Number.isFinite(lastInboundMs)) return false;
  return nowMs - lastInboundMs <= CUSTOMER_SERVICE_WINDOW_MS;
}

export function resolveLastInboundAtFromMessages(
  messages: Array<Pick<Message, "role" | "source" | "timestamp">>
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "user" || message.source === "whatsapp_inbound") {
      const ms = new Date(message.timestamp).getTime();
      if (Number.isFinite(ms)) return message.timestamp;
    }
  }
  return null;
}

export class CustomerServiceWindowClosedError extends Error {
  statusCode = 400;
  code = "CUSTOMER_SERVICE_WINDOW_CLOSED";

  constructor(
    message = "Customer service window is closed. Send an approved WhatsApp template message instead."
  ) {
    super(message);
  }
}

export function assertCustomerServiceWindowOpen(
  conversation: Pick<Conversation, "lastInboundAt" | "channel"> | null,
  nowMs: number = Date.now()
): void {
  if (!isCustomerServiceWindowOpen(conversation, nowMs)) {
    throw new CustomerServiceWindowClosedError();
  }
}
