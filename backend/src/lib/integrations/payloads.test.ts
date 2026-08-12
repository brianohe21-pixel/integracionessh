import {
  buildMessageReceivedPayload,
  buildConversationHandoffPayload,
  buildCallTerminatedPayload,
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

  it("builds call.terminated payload", () => {
    const payload = buildCallTerminatedPayload({
      tenantId: "t1",
      botId: "b1",
      callId: "c1",
      direction: "USER_INITIATED",
      phoneNumber: "+17875550199",
      status: "completed",
      duration: 185,
      startedAt: "2026-08-12T17:25:00.000Z",
      endedAt: "2026-08-12T17:28:05.000Z",
      businessPhoneNumber: "+576013075392",
      structuredOutputs: {
        name: "customer_order",
        result: { subtotal: 34.98 },
      },
    });

    expect(payload.event).toBe("call.terminated");
    expect(payload.data.botId).toBe("b1");
    expect(payload.data.businessPhoneNumber).toBe("+576013075392");
    expect(payload.data.structuredOutputs).toEqual({
      name: "customer_order",
      result: { subtotal: 34.98 },
    });
  });
});
