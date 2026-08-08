import { normalizeEmailMessage } from "./inbound.js";
import type { EmailInboundPayload } from "../../types/index.js";

describe("normalizeEmailMessage", () => {
  it("keeps plain text without subject prefix", () => {
    const payload: EmailInboundPayload = {
      from: "a@example.com",
      to: "b@example.com",
      subject: "Test",
      text: "Hello",
      messageId: "1",
    };
    const normalized = normalizeEmailMessage(payload);
    expect(normalized.text).toBe("Hello");
    expect(normalized.messageType).toBe("text");
  });
});
