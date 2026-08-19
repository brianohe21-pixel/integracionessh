import type { CallRecord, Message } from "../../types/index.js";
import { filterMessagesForCall, messageBelongsToCall } from "./transcript.js";

const call: CallRecord = {
  callId: "call-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  phoneNumber: "+15551234567",
  direction: "USER_INITIATED",
  status: "completed",
  conversationId: "conv-1",
  startedAt: "2026-08-14T10:00:00.000Z",
  endedAt: "2026-08-14T10:05:00.000Z",
  duration: 300,
  createdAt: "2026-08-14T10:00:00.000Z",
  updatedAt: "2026-08-14T10:05:00.000Z",
};

function message(
  overrides: Partial<Message> & Pick<Message, "messageId" | "timestamp" | "role" | "content">
): Message {
  return {
    conversationId: "conv-1",
    tenantId: "tenant-1",
    ...overrides,
  };
}

describe("telephony transcript filtering", () => {
  it("matches messages tagged with callId", () => {
    const tagged = message({
      messageId: "m-1",
      role: "user",
      content: "Hola",
      timestamp: "2026-08-14T10:01:00.000Z",
      callId: "call-1",
      channel: "phone",
    });
    const otherCall = message({
      messageId: "m-2",
      role: "user",
      content: "Otra llamada",
      timestamp: "2026-08-14T10:01:00.000Z",
      callId: "call-2",
      channel: "phone",
    });

    expect(messageBelongsToCall(tagged, call)).toBe(true);
    expect(messageBelongsToCall(otherCall, call)).toBe(false);
  });

  it("matches legacy messages inside the call window", () => {
    const inside = message({
      messageId: "m-3",
      role: "assistant",
      content: "Bienvenido",
      timestamp: "2026-08-14T10:02:00.000Z",
      channel: "phone",
    });
    const outside = message({
      messageId: "m-4",
      role: "user",
      content: "Llamada anterior",
      timestamp: "2026-08-14T09:30:00.000Z",
      channel: "phone",
    });

    expect(messageBelongsToCall(inside, call)).toBe(true);
    expect(messageBelongsToCall(outside, call)).toBe(false);
  });

  it("sorts transcript chronologically", () => {
    const sorted = filterMessagesForCall(
      [
        message({
          messageId: "m-5",
          role: "assistant",
          content: "Segundo",
          timestamp: "2026-08-14T10:02:00.000Z",
          callId: "call-1",
          channel: "phone",
        }),
        message({
          messageId: "m-6",
          role: "user",
          content: "Primero",
          timestamp: "2026-08-14T10:01:00.000Z",
          callId: "call-1",
          channel: "phone",
        }),
      ],
      call
    );

    expect(sorted.map((item) => item.messageId)).toEqual(["m-6", "m-5"]);
  });
});
