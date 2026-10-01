import type { Conversation, Message } from "@/types";

export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FREE_ENTRY_POINT_WINDOW_MS = 72 * 60 * 60 * 1000;
export const FREE_ENTRY_POINT_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const WINDOW_24_EXPIRING_MS = 2 * 60 * 60 * 1000;
export const WINDOW_72_EXPIRING_MS = 6 * 60 * 60 * 1000;

export type Window24Status = "open" | "expiring" | "closed" | "unknown";
export type Window72Status =
  | "hidden"
  | "eligible"
  | "open"
  | "expiring"
  | "closed"
  | "missed";

export type WhatsAppMessagingWindows = {
  show: boolean;
  window24: {
    status: Window24Status;
    remainingMs: number | null;
  };
  window72: {
    status: Window72Status;
    remainingMs: number | null;
  };
};

function parseMs(value?: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function resolveLastInboundAt(
  conversation: Pick<Conversation, "lastInboundAt">,
  messages?: Message[]
): number | null {
  const stored = parseMs(conversation.lastInboundAt);
  if (stored !== null) return stored;
  if (!messages?.length) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "user" || message.source === "whatsapp_inbound") {
      return parseMs(message.timestamp);
    }
  }
  return null;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m";
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 48) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatWindowRemaining(ms: number | null): string {
  if (ms === null) return "";
  return formatRemaining(ms);
}

export function canSendFreeFormWhatsAppMessages(
  windows: WhatsAppMessagingWindows
): boolean {
  if (!windows.show) return true;
  return windows.window24.status === "open" || windows.window24.status === "expiring";
}

export function getWhatsAppMessagingWindows(
  conversation: Pick<
    Conversation,
    | "channel"
    | "attribution"
    | "createdAt"
    | "lastInboundAt"
    | "freeEntryPointOpenedAt"
  > | null,
  messages?: Message[],
  nowMs: number = Date.now()
): WhatsAppMessagingWindows {
  if (!conversation || (conversation.channel ?? "whatsapp") !== "whatsapp") {
    return {
      show: false,
      window24: { status: "unknown", remainingMs: null },
      window72: { status: "hidden", remainingMs: null },
    };
  }

  const lastInboundMs = resolveLastInboundAt(conversation, messages);
  let window24Status: Window24Status = "unknown";
  let window24Remaining: number | null = null;
  if (lastInboundMs !== null) {
    window24Remaining = lastInboundMs + CUSTOMER_SERVICE_WINDOW_MS - nowMs;
    if (window24Remaining <= 0) {
      window24Status = "closed";
      window24Remaining = 0;
    } else if (window24Remaining <= WINDOW_24_EXPIRING_MS) {
      window24Status = "expiring";
    } else {
      window24Status = "open";
    }
  }

  let window72Status: Window72Status = "hidden";
  let window72Remaining: number | null = null;
  if (conversation.attribution?.source === "meta_ctwa") {
    const openedMs = parseMs(conversation.freeEntryPointOpenedAt);
    if (openedMs !== null) {
      window72Remaining = openedMs + FREE_ENTRY_POINT_WINDOW_MS - nowMs;
      if (window72Remaining <= 0) {
        window72Status = "closed";
        window72Remaining = 0;
      } else if (window72Remaining <= WINDOW_72_EXPIRING_MS) {
        window72Status = "expiring";
      } else {
        window72Status = "open";
      }
    } else {
      const createdMs = parseMs(conversation.createdAt);
      if (createdMs !== null) {
        const replyDeadlineRemaining = createdMs + FREE_ENTRY_POINT_REPLY_WINDOW_MS - nowMs;
        if (replyDeadlineRemaining > 0) {
          window72Status = "eligible";
          window72Remaining = replyDeadlineRemaining;
        } else {
          window72Status = "missed";
          window72Remaining = 0;
        }
      } else {
        window72Status = "missed";
        window72Remaining = 0;
      }
    }
  }

  return {
    show: true,
    window24: { status: window24Status, remainingMs: window24Remaining },
    window72: { status: window72Status, remainingMs: window72Remaining },
  };
}
