import type { Conversation } from "../../types/index.js";
import { shouldDeliverToConnection } from "./publish.js";
import type { RealtimeConnection } from "./types.js";

function connection(overrides: Partial<RealtimeConnection> & Pick<RealtimeConnection, "role">): RealtimeConnection {
  return {
    connectionId: "conn-1",
    tenantId: "tenant-1",
    userId: "user-1",
    connectedAt: new Date().toISOString(),
    ...overrides,
  };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: "conv-1",
    tenantId: "tenant-1",
    botId: "bot-1",
    phoneNumber: "573001112233",
    participantId: "573001112233",
    channel: "whatsapp",
    status: "active",
    messageCount: 1,
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("shouldDeliverToConnection", () => {
  it("delivers all tenant events to members", () => {
    expect(
      shouldDeliverToConnection(connection({ role: "member" }), conversation())
    ).toBe(true);
  });

  it("delivers advisor events only for assigned conversations", () => {
    const conv = conversation({ assignedAdvisorId: "adv-1" });
    expect(
      shouldDeliverToConnection(
        connection({ role: "advisor", advisorId: "adv-1" }),
        conv
      )
    ).toBe(true);
    expect(
      shouldDeliverToConnection(
        connection({ role: "advisor", advisorId: "adv-2" }),
        conv
      )
    ).toBe(false);
  });
});
