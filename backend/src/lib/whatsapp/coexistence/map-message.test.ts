import { buildMessageFromEcho, buildMessageFromHistory } from "./map-message.js";

describe("coexistence map-message", () => {
  it("maps inbound history to user role", () => {
    const message = buildMessageFromHistory({
      tenantId: "t1",
      conversationId: "c1",
      threadParticipantId: "16505551234",
      businessPhone: "15550783881",
      message: {
        from: "16505551234",
        id: "wamid.user",
        timestamp: "1739230970",
        type: "text",
        text: { body: "Hi" },
      },
    });
    expect(message.role).toBe("user");
    expect(message.source).toBe("whatsapp_history");
  });

  it("maps outbound history to advisor role", () => {
    const message = buildMessageFromHistory({
      tenantId: "t1",
      conversationId: "c1",
      threadParticipantId: "16505551234",
      businessPhone: "15550783881",
      message: {
        from: "15550783881",
        id: "wamid.biz",
        timestamp: "1739230970",
        type: "text",
        text: { body: "Hello" },
      },
    });
    expect(message.role).toBe("advisor");
    expect(message.source).toBe("whatsapp_history");
  });

  it("maps echo to advisor with app echo source", () => {
    const message = buildMessageFromEcho({
      tenantId: "t1",
      conversationId: "c1",
      echo: {
        from: "15550783881",
        to: "16505551234",
        id: "wamid.echo",
        timestamp: "1739230970",
        type: "text",
        text: { body: "From app" },
      },
    });
    expect(message.role).toBe("advisor");
    expect(message.source).toBe("whatsapp_app_echo");
  });
});
