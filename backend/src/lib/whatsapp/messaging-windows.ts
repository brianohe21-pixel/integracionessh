import type { Conversation } from "../../types/index.js";

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
