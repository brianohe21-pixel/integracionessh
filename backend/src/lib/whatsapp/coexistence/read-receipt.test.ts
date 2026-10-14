import { inboundShouldSkipReadReceipt, isWhatsAppCoexistence } from "./read-receipt.js";
import {
  getWhatsAppChannel,
  getWhatsAppChannelByPhoneNumberId,
} from "../../dynamodb/whatsapp-channel.repository.js";

jest.mock("../../dynamodb/whatsapp-channel.repository.js", () => ({
  getWhatsAppChannel: jest.fn(),
  getWhatsAppChannelByPhoneNumberId: jest.fn(),
}));

const getChannel = getWhatsAppChannel as jest.MockedFunction<typeof getWhatsAppChannel>;
const getChannelByPhone = getWhatsAppChannelByPhoneNumberId as jest.MockedFunction<
  typeof getWhatsAppChannelByPhoneNumberId
>;

describe("isWhatsAppCoexistence", () => {
  it("is true when the number is on the WhatsApp Business app", () => {
    expect(isWhatsAppCoexistence({ isOnBizApp: true })).toBe(true);
  });

  it("is true for coexistence onboarding", () => {
    expect(isWhatsAppCoexistence({ whatsappOnboardingMode: "coexistence" })).toBe(true);
  });

  it("is false for Cloud API numbers", () => {
    expect(
      isWhatsAppCoexistence({ isOnBizApp: false, whatsappOnboardingMode: "cloud_api" })
    ).toBe(false);
  });
});

describe("inboundShouldSkipReadReceipt", () => {
  const bot = {
    phoneNumberId: "111",
    isOnBizApp: false,
    whatsappOnboardingMode: "cloud_api" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips read receipts for the inbound coexistence channel", async () => {
    getChannel.mockResolvedValue({
      isOnBizApp: true,
      whatsappOnboardingMode: "coexistence",
    } as Awaited<ReturnType<typeof getWhatsAppChannel>>);

    await expect(
      inboundShouldSkipReadReceipt({
        tenantId: "t1",
        botId: "b1",
        bot,
        phoneNumberId: "222",
        channelId: "ch-1",
      })
    ).resolves.toBe(true);
  });

  it("keeps read receipts for a Cloud API channel", async () => {
    getChannel.mockResolvedValue({
      isOnBizApp: false,
      whatsappOnboardingMode: "cloud_api",
    } as Awaited<ReturnType<typeof getWhatsAppChannel>>);

    await expect(
      inboundShouldSkipReadReceipt({
        tenantId: "t1",
        botId: "b1",
        bot: { ...bot, isOnBizApp: true, whatsappOnboardingMode: "coexistence" },
        channelId: "ch-cloud",
      })
    ).resolves.toBe(false);
  });

  it("falls back to the bot when the inbound number is the bot number", async () => {
    await expect(
      inboundShouldSkipReadReceipt({
        tenantId: "t1",
        botId: "b1",
        bot: { ...bot, isOnBizApp: true },
        phoneNumberId: "111",
      })
    ).resolves.toBe(true);
    expect(getChannelByPhone).not.toHaveBeenCalled();
  });
});
