import { assertWhatsAppOutboundAllowed, WhatsAppOutboundBlockedError } from "./outbound-guard.js";
import { getWhatsAppChannelByPhoneNumberId } from "../dynamodb/whatsapp-channel.repository.js";
import { getWhatsAppAccount } from "../dynamodb/whatsapp-account.repository.js";
import { checkMarketingRecipients } from "../compliance/recipient-policy.js";

jest.mock("../dynamodb/whatsapp-channel.repository.js", () => ({
  getWhatsAppChannelByPhoneNumberId: jest.fn(),
}));

jest.mock("../dynamodb/whatsapp-account.repository.js", () => ({
  getWhatsAppAccount: jest.fn(),
}));

jest.mock("../dynamodb/contact.repository.js", () => ({
  getContactByPhone: jest.fn(),
}));

jest.mock("../compliance/recipient-policy.js", () => ({
  checkMarketingRecipients: jest.fn(),
}));

const mockedGetChannel = getWhatsAppChannelByPhoneNumberId as jest.MockedFunction<
  typeof getWhatsAppChannelByPhoneNumberId
>;
const mockedGetAccount = getWhatsAppAccount as jest.MockedFunction<typeof getWhatsAppAccount>;
const mockedCheckMarketing = checkMarketingRecipients as jest.MockedFunction<
  typeof checkMarketingRecipients
>;

describe("assertWhatsAppOutboundAllowed", () => {
  beforeEach(() => {
    mockedGetChannel.mockReset();
    mockedGetAccount.mockReset();
    mockedCheckMarketing.mockReset();
  });

  it("blocks outbound when channel is Meta-enforced", async () => {
    mockedGetChannel.mockResolvedValue({
      tenantId: "t1",
      botId: "b1",
      channelId: "c1",
      accountId: "a1",
      phoneNumberId: "pn1",
      whatsappBusinessAccountId: "waba1",
      status: "active",
      isDefault: true,
      createdAt: "",
      updatedAt: "",
      messagingEnforcement: {
        blocked: true,
        reason: "red",
        source: "meta_auto",
      },
    });

    await expect(
      assertWhatsAppOutboundAllowed({
        tenantId: "t1",
        phoneNumberId: "pn1",
        kind: "service",
      })
    ).rejects.toBeInstanceOf(WhatsAppOutboundBlockedError);
  });

  it("requires marketing opt-in when kind is marketing", async () => {
    mockedGetChannel.mockResolvedValue(null);
    mockedCheckMarketing.mockResolvedValue({ allowed: [], blocked: [] });

    await expect(
      assertWhatsAppOutboundAllowed({
        tenantId: "t1",
        phoneNumberId: "pn1",
        kind: "marketing",
        to: "573001234567",
        requireOptIn: true,
      })
    ).rejects.toBeInstanceOf(WhatsAppOutboundBlockedError);
  });

  it("allows service send when channel is clear", async () => {
    mockedGetChannel.mockResolvedValue({
      tenantId: "t1",
      botId: "b1",
      channelId: "c1",
      accountId: "a1",
      phoneNumberId: "pn1",
      whatsappBusinessAccountId: "waba1",
      status: "active",
      isDefault: true,
      createdAt: "",
      updatedAt: "",
    });
    mockedGetAccount.mockResolvedValue({
      accountId: "a1",
      tenantId: "t1",
      wabaId: "waba1",
      status: "active",
      createdAt: "",
      updatedAt: "",
    });

    await expect(
      assertWhatsAppOutboundAllowed({
        tenantId: "t1",
        phoneNumberId: "pn1",
        kind: "service",
        to: "573001234567",
      })
    ).resolves.toBeTruthy();
  });
});
