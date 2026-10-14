import type { Conversation } from "../../types/index.js";
import { getAdvisor } from "../dynamodb/advisor.repository.js";
import { updateConversation } from "../dynamodb/conversation.repository.js";
import { getWhatsAppChannelByPhoneNumberId } from "../dynamodb/whatsapp-channel.repository.js";
import { sendTextMessage } from "../whatsapp/client.js";
import { assertWhatsAppOutboundAllowed } from "../whatsapp/outbound-guard.js";
import { isSameWhatsAppRecipient, notifyAdvisorOfConversation } from "./notify.js";

jest.mock("../dynamodb/advisor.repository.js", () => ({
  getAdvisor: jest.fn(),
}));

jest.mock("../dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(),
}));

jest.mock("../dynamodb/conversation.repository.js", () => ({
  updateConversation: jest.fn(),
}));

jest.mock("../dynamodb/whatsapp-channel.repository.js", () => ({
  getWhatsAppChannelByPhoneNumberId: jest.fn(),
}));

jest.mock("../whatsapp/client.js", () => ({
  sendTextMessage: jest.fn(),
  truncateWhatsAppText: (text: string) => text,
}));

jest.mock("../whatsapp/outbound-guard.js", () => ({
  assertWhatsAppOutboundAllowed: jest.fn(),
}));

const conversation = {
  conversationId: "c1",
  assignedAdvisorId: "a1",
  channel: "whatsapp",
  participantId: "573001112233",
  phoneNumber: "573001112233",
  contactName: "Cliente",
} as Conversation;

describe("isSameWhatsAppRecipient", () => {
  it("matches a formatted business number with the advisor phone", () => {
    expect(isSameWhatsAppRecipient("+57 310 7829727", "573107829727")).toBe(true);
  });

  it("does not match a different business number", () => {
    expect(isSameWhatsAppRecipient("+57 317 5410376", "573107829727")).toBe(false);
  });
});

describe("notifyAdvisorOfConversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAdvisor as jest.Mock).mockResolvedValue({
      advisorId: "a1",
      status: "active",
      phoneNumber: "573107829727",
      name: "Karen",
    });
    (updateConversation as jest.Mock).mockResolvedValue(conversation);
    (assertWhatsAppOutboundAllowed as jest.Mock).mockResolvedValue(undefined);
  });

  it("does not send for a coexistence number", async () => {
    (getWhatsAppChannelByPhoneNumberId as jest.Mock).mockResolvedValue({
      displayPhoneNumber: "+57 317 5410376",
      isOnBizApp: true,
      whatsappOnboardingMode: "coexistence",
    });

    await notifyAdvisorOfConversation({
      tenantId: "t1",
      botId: "b1",
      conversation,
      phoneNumberId: "1823892237732199",
      accessToken: "token",
      lastMessagePreview: "Hola",
      force: true,
    });

    expect(sendTextMessage).not.toHaveBeenCalled();
  });

  it("does not send when the advisor phone is the business number", async () => {
    (getWhatsAppChannelByPhoneNumberId as jest.Mock).mockResolvedValue({
      displayPhoneNumber: "+57 310 7829727",
      isOnBizApp: false,
      whatsappOnboardingMode: "cloud_api",
    });

    await notifyAdvisorOfConversation({
      tenantId: "t1",
      botId: "b1",
      conversation,
      phoneNumberId: "111695061866771",
      accessToken: "token",
      lastMessagePreview: "Hola",
      force: true,
    });

    expect(sendTextMessage).not.toHaveBeenCalled();
    expect(updateConversation).toHaveBeenCalled();
  });

  it("keeps the inbound message when WhatsApp rejects the notify", async () => {
    (getWhatsAppChannelByPhoneNumberId as jest.Mock).mockResolvedValue({
      displayPhoneNumber: "+57 317 5410376",
    });
    (sendTextMessage as jest.Mock).mockRejectedValue(
      Object.assign(new Error("(#100) Invalid parameter"), { statusCode: 400 })
    );

    await expect(
      notifyAdvisorOfConversation({
        tenantId: "t1",
        botId: "b1",
        conversation,
        phoneNumberId: "1823892237732199",
        accessToken: "token",
        lastMessagePreview: "Hola",
        force: true,
      })
    ).resolves.toBeUndefined();
    expect(updateConversation).not.toHaveBeenCalled();
  });
});
