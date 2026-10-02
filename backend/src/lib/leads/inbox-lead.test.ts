import { resolveConversationPhone } from "./inbox-lead.js";
import type { Conversation } from "../../types/index.js";

function conversation(overrides: Partial<Conversation>): Conversation {
  return {
    conversationId: "conv-1",
    tenantId: "tenant-1",
    botId: "bot-1",
    channel: "whatsapp",
    participantId: "573001234567",
    phoneNumber: "573001234567",
    status: "active",
    messageCount: 1,
    lastMessageAt: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveConversationPhone", () => {
  it("prefers a real phone over BSUID", () => {
    expect(
      resolveConversationPhone(
        conversation({
          phoneNumber: "573001234567",
          participantId: "CO.2268328677295906",
          whatsappUserId: "CO.2268328677295906",
        })
      )
    ).toBe("573001234567");
  });

  it("returns BSUID when no phone is available", () => {
    expect(
      resolveConversationPhone(
        conversation({
          phoneNumber: "CO.2268328677295906",
          participantId: "CO.2268328677295906",
          whatsappUserId: "CO.2268328677295906",
        })
      )
    ).toBe("CO.2268328677295906");
  });
});
