import type { Conversation, Message } from "../../types/index.js";
import {
  SERVICE_MESSAGES_QUOTA,
  assembleConversationsByClientReport,
  summarizeConversationForClientReport,
} from "./conversations-by-client-metrics.repository.js";

function conversation(
  overrides: Partial<Conversation> & Pick<Conversation, "conversationId" | "phoneNumber">
): Conversation {
  const now = "2026-10-05T12:00:00.000Z";
  return {
    tenantId: "t1",
    botId: "b1",
    channel: "whatsapp",
    participantId: overrides.phoneNumber,
    status: "active",
    workflowStatus: "open",
    messageCount: 2,
    lastMessageAt: now,
    createdAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

function message(
  overrides: Partial<Message> & Pick<Message, "messageId" | "timestamp" | "role">
): Message {
  return {
    tenantId: "t1",
    conversationId: "c1",
    channel: "whatsapp",
    content: "hi",
    ...overrides,
  };
}

describe("conversations by client metrics", () => {
  const range = { from: "2026-10-01", to: "2026-10-07" };

  it("aggregates conversations, AI, service, inbound and outbound by contact phone", () => {
    const first = summarizeConversationForClientReport({
      conversation: conversation({
        conversationId: "c1",
        phoneNumber: "573111111111",
        contactName: "Alice",
      }),
      messages: [
        message({
          messageId: "m1",
          timestamp: "2026-10-02T10:00:00.000Z",
          role: "user",
          source: "whatsapp_inbound",
        }),
        message({
          messageId: "m2",
          timestamp: "2026-10-02T10:05:00.000Z",
          role: "assistant",
        }),
        message({
          messageId: "m3",
          timestamp: "2026-10-02T10:06:00.000Z",
          role: "advisor",
          source: "panel",
        }),
      ],
      ...range,
    });

    const second = summarizeConversationForClientReport({
      conversation: conversation({
        conversationId: "c2",
        phoneNumber: "573111111111",
        contactName: "Alice Updated",
        lastMessageAt: "2026-10-06T12:00:00.000Z",
      }),
      messages: [
        message({
          messageId: "m4",
          conversationId: "c2",
          timestamp: "2026-10-06T11:00:00.000Z",
          role: "user",
          source: "whatsapp_inbound",
        }),
        message({
          messageId: "m5",
          conversationId: "c2",
          timestamp: "2026-10-06T11:01:00.000Z",
          role: "assistant",
        }),
      ],
      ...range,
    });

    const other = summarizeConversationForClientReport({
      conversation: conversation({
        conversationId: "c3",
        phoneNumber: "573222222222",
        contactName: "Bob",
      }),
      messages: [
        message({
          messageId: "m6",
          conversationId: "c3",
          timestamp: "2026-10-03T09:00:00.000Z",
          role: "user",
          source: "whatsapp_inbound",
        }),
      ],
      ...range,
    });

    const report = assembleConversationsByClientReport(
      [first, second, other].filter((row): row is NonNullable<typeof row> => row !== null),
      range
    );

    expect(report.serviceMessagesQuota).toBe(SERVICE_MESSAGES_QUOTA);
    expect(report.rows).toHaveLength(2);

    const alice = report.rows.find((row) => row.clientKey === "573111111111");
    expect(alice).toMatchObject({
      clientName: "Alice Updated",
      conversations: 2,
      aiUsage: 2,
      serviceMessagesUsed: 3,
      serviceMessagesQuota: 1000,
      inbound: 2,
      outbound: 3,
    });

    const bob = report.rows.find((row) => row.clientKey === "573222222222");
    expect(bob).toMatchObject({
      clientName: "Bob",
      conversations: 1,
      aiUsage: 0,
      serviceMessagesUsed: 0,
      inbound: 1,
      outbound: 0,
    });

    expect(report.totals).toMatchObject({
      conversations: 3,
      aiUsage: 2,
      serviceMessagesUsed: 3,
      inbound: 3,
      outbound: 3,
    });
  });

  it("ignores messages outside the selected date range", () => {
    const stats = summarizeConversationForClientReport({
      conversation: conversation({
        conversationId: "c1",
        phoneNumber: "573111111111",
        lastMessageAt: "2026-10-20T12:00:00.000Z",
      }),
      messages: [
        message({
          messageId: "old",
          timestamp: "2026-09-20T10:00:00.000Z",
          role: "user",
          source: "whatsapp_inbound",
        }),
        message({
          messageId: "in-range",
          timestamp: "2026-10-02T10:00:00.000Z",
          role: "user",
          source: "whatsapp_inbound",
        }),
        message({
          messageId: "reply",
          timestamp: "2026-10-02T10:01:00.000Z",
          role: "assistant",
        }),
        message({
          messageId: "future",
          timestamp: "2026-10-20T10:00:00.000Z",
          role: "assistant",
        }),
      ],
      ...range,
    });

    expect(stats).toMatchObject({
      inbound: 1,
      outbound: 1,
      aiUsage: 1,
      serviceMessagesUsed: 1,
    });
  });

  it("counts outbound outside the 24h service window as outbound but not service", () => {
    const stats = summarizeConversationForClientReport({
      conversation: conversation({
        conversationId: "c1",
        phoneNumber: "573111111111",
      }),
      messages: [
        message({
          messageId: "m1",
          timestamp: "2026-10-01T10:00:00.000Z",
          role: "user",
          source: "whatsapp_inbound",
        }),
        message({
          messageId: "m2",
          timestamp: "2026-10-03T12:00:00.000Z",
          role: "assistant",
        }),
      ],
      ...range,
    });

    expect(stats).toMatchObject({
      inbound: 1,
      outbound: 1,
      aiUsage: 1,
      serviceMessagesUsed: 0,
    });
  });
});
