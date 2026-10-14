import type { Message } from "../../types/index.js";
import { latestInboundWhatsAppMessageId } from "./read-on-open.js";

function message(partial: Partial<Message> & Pick<Message, "role" | "messageId">): Message {
  return {
    conversationId: "c1",
    tenantId: "t1",
    content: "hola",
    timestamp: "2026-10-14T00:00:00.000Z",
    channel: "whatsapp",
    ...partial,
  };
}

describe("latestInboundWhatsAppMessageId", () => {
  it("returns the newest inbound WhatsApp message id", () => {
    const id = latestInboundWhatsAppMessageId([
      message({ role: "user", messageId: "wamid.old", whatsappMessageId: "wamid.old" }),
      message({ role: "advisor", messageId: "out", externalMessageId: "wamid.out" }),
      message({ role: "user", messageId: "wamid.new", whatsappMessageId: "wamid.new" }),
    ]);
    expect(id).toBe("wamid.new");
  });

  it("returns null when there is no inbound WhatsApp message", () => {
    expect(
      latestInboundWhatsAppMessageId([
        message({ role: "assistant", messageId: "a1", channel: "webchat" }),
      ])
    ).toBeNull();
  });
});
