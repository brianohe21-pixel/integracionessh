import {
  formatWindowRemaining,
  getWhatsAppMessagingWindows,
} from "./whatsapp-messaging-windows";
import type { Conversation, Message } from "@/types";

const baseConversation = {
  conversationId: "c1",
  tenantId: "t1",
  botId: "b1",
  channel: "whatsapp" as const,
  phoneNumber: "573001112233",
  status: "active" as const,
  messageCount: 2,
  lastMessageAt: "2026-09-30T10:00:00.000Z",
  createdAt: "2026-09-29T10:00:00.000Z",
} satisfies Partial<Conversation> as Conversation;

describe("getWhatsAppMessagingWindows", () => {
  it("hides for non-whatsapp channels", () => {
    const result = getWhatsAppMessagingWindows({
      ...baseConversation,
      channel: "instagram",
    });
    expect(result.show).toBe(false);
    expect(result.window72.status).toBe("hidden");
  });

  it("marks 24h window open from lastInboundAt", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const result = getWhatsAppMessagingWindows(
      {
        ...baseConversation,
        lastInboundAt: "2026-09-30T10:00:00.000Z",
      },
      undefined,
      now
    );
    expect(result.window24.status).toBe("open");
    expect(result.window24.remainingMs).toBe(22 * 60 * 60 * 1000);
  });

  it("marks 24h window expiring under 2 hours", () => {
    const now = Date.parse("2026-09-30T11:30:00.000Z");
    const result = getWhatsAppMessagingWindows(
      {
        ...baseConversation,
        lastInboundAt: "2026-09-29T12:00:00.000Z",
      },
      undefined,
      now
    );
    expect(result.window24.status).toBe("expiring");
  });

  it("falls back to latest user message when lastInboundAt is missing", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const messages: Message[] = [
      {
        messageId: "m1",
        conversationId: "c1",
        tenantId: "t1",
        role: "assistant",
        content: "hola",
        timestamp: "2026-09-30T09:00:00.000Z",
      },
      {
        messageId: "m2",
        conversationId: "c1",
        tenantId: "t1",
        role: "user",
        content: "hi",
        timestamp: "2026-09-30T11:00:00.000Z",
      },
    ];
    const result = getWhatsAppMessagingWindows(baseConversation, messages, now);
    expect(result.window24.status).toBe("open");
    expect(result.window24.remainingMs).toBe(23 * 60 * 60 * 1000);
  });

  it("shows 72h eligible for CTWA before first reply deadline", () => {
    const now = Date.parse("2026-09-29T20:00:00.000Z");
    const result = getWhatsAppMessagingWindows(
      {
        ...baseConversation,
        createdAt: "2026-09-29T10:00:00.000Z",
        attribution: { source: "meta_ctwa" },
      },
      undefined,
      now
    );
    expect(result.window72.status).toBe("eligible");
    expect(result.window72.remainingMs).toBe(14 * 60 * 60 * 1000);
  });

  it("shows 72h open after free entry point opens", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const result = getWhatsAppMessagingWindows(
      {
        ...baseConversation,
        attribution: { source: "meta_ctwa" },
        freeEntryPointOpenedAt: "2026-09-29T12:00:00.000Z",
      },
      undefined,
      now
    );
    expect(result.window72.status).toBe("open");
    expect(result.window72.remainingMs).toBe(48 * 60 * 60 * 1000);
  });

  it("shows 72h missed when reply window elapsed", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const result = getWhatsAppMessagingWindows(
      {
        ...baseConversation,
        createdAt: "2026-09-28T10:00:00.000Z",
        attribution: { source: "meta_ctwa" },
      },
      undefined,
      now
    );
    expect(result.window72.status).toBe("missed");
  });
});

describe("formatWindowRemaining", () => {
  it("formats hours and minutes", () => {
    expect(formatWindowRemaining(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe("2h 15m");
  });
});
