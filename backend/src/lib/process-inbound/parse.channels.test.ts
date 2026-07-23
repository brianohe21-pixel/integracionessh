import { assertPayloadMatchesChannel, channelLabel, externalMessageIdFromBody } from "./parse.js";
import type { InboundQueueMessage } from "../../types/index.js";

describe("parse inbound channels", () => {
  it("labels new channels", () => {
    expect(channelLabel("telegram")).toBe("Telegram");
    expect(channelLabel("messenger")).toBe("Messenger");
    expect(channelLabel("sms")).toBe("SMS");
    expect(channelLabel("email")).toBe("Email");
  });

  it("extracts external ids for telegram and sms", () => {
    const telegramBody: InboundQueueMessage = {
      channel: "telegram",
      tenantId: "t1",
      botId: "b1",
      participantId: "123",
      conversationKey: "ck",
      payload: {
        updateId: 1,
        chatId: "123",
        messageId: 99,
        text: "hi",
      },
    };
    expect(externalMessageIdFromBody(telegramBody)).toBe("99");
    assertPayloadMatchesChannel(telegramBody);

    const smsBody: InboundQueueMessage = {
      channel: "sms",
      tenantId: "t1",
      botId: "b1",
      participantId: "+15551234567",
      conversationKey: "ck",
      payload: {
        originationNumber: "+15551234567",
        destinationNumber: "+15559876543",
        messageBody: "hello",
        inboundMessageId: "sms-1",
      },
    };
    expect(externalMessageIdFromBody(smsBody)).toBe("sms-1");
    assertPayloadMatchesChannel(smsBody);
  });
});
