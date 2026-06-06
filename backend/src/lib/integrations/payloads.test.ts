import {
  buildMessageReceivedPayload,
  buildConversationHandoffPayload,
  buildTestPayload,
} from "./payloads.js";

describe("integration payloads", () => {
  it("builds message.received payload", () => {
    const payload = buildMessageReceivedPayload({
      tenantId: "t1",
      botId: "b1",
      conversationId: "c1",
      from: "57300",
      message: "hola",
      contactName: "Ana",
    });
    expect(payload.event).toBe("message.received");
    expect(payload.tenantId).toBe("t1");
    expect(payload.data.from).toBe("57300");
    expect(payload.data.contact).toEqual({ name: "Ana" });
  });

  it("builds conversation.handoff payload", () => {
    const payload = buildConversationHandoffPayload({
      tenantId: "t1",
      botId: "b1",
      conversationId: "c1",
      phoneNumber: "57300",
      reason: "ai",
      advisorId: "a1",
    });
    expect(payload.event).toBe("conversation.handoff");
    expect(payload.data.advisorId).toBe("a1");
  });

  it("builds test payload", () => {
    const payload = buildTestPayload("t1");
    expect(payload.tenantId).toBe("t1");
    expect(payload.event).toBe("message.received");
  });
});
