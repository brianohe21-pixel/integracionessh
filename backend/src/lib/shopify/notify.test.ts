import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { sendShopifyWhatsAppTemplate } from "./notify.js";
import { putShopifyDelivery } from "../dynamodb/shopify.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getWhatsAppAccessToken, sendTemplateMessage } from "../whatsapp/client.js";
import { assertWhatsAppOutboundAllowed } from "../whatsapp/outbound-guard.js";
import type { ShopifyConfig } from "../../types/index.js";

jest.mock("../dynamodb/shopify.repository.js", () => ({
  putShopifyDelivery: jest.fn(),
}));

jest.mock("../dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(),
}));

jest.mock("../whatsapp/client.js", () => ({
  getWhatsAppAccessToken: jest.fn(),
  sendTemplateMessage: jest.fn(),
}));

jest.mock("../whatsapp/outbound-guard.js", () => ({
  assertWhatsAppOutboundAllowed: jest.fn(),
  WhatsAppOutboundBlockedError: class WhatsAppOutboundBlockedError extends Error {},
}));

const mockedPutDelivery = putShopifyDelivery as jest.MockedFunction<typeof putShopifyDelivery>;
const mockedGetBot = getBot as jest.MockedFunction<typeof getBot>;
const mockedGetToken = getWhatsAppAccessToken as jest.MockedFunction<typeof getWhatsAppAccessToken>;
const mockedSendTemplate = sendTemplateMessage as jest.MockedFunction<typeof sendTemplateMessage>;
const mockedAssertOutbound = assertWhatsAppOutboundAllowed as jest.MockedFunction<
  typeof assertWhatsAppOutboundAllowed
>;

const baseConfig: ShopifyConfig = {
  tenantId: "t1",
  shopDomain: "demo.myshopify.com",
  status: "connected",
  enabled: true,
  botId: "bot1",
  abandonDelayMinutes: 60,
  defaultCountry: "CO",
  templates: {
    abandoned_checkout: {
      templateName: "cart_abandon",
      templateLanguage: "es",
      variableKeys: ["name", "checkout_url"],
    },
    order_paid: {
      templateName: "order_paid",
      templateLanguage: "es",
      variableKeys: ["name", "order_number"],
    },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("sendShopifyWhatsAppTemplate", () => {
  beforeEach(() => {
    mockedPutDelivery.mockReset();
    mockedGetBot.mockReset();
    mockedGetToken.mockReset();
    mockedSendTemplate.mockReset();
    mockedAssertOutbound.mockReset();
    mockedGetBot.mockResolvedValue({
      botId: "bot1",
      phoneNumberId: "phone1",
    } as Awaited<ReturnType<typeof getBot>>);
    mockedGetToken.mockResolvedValue("token");
    mockedSendTemplate.mockResolvedValue({ messages: [{ id: "wamid.1" }] } as never);
    mockedAssertOutbound.mockResolvedValue(null);
    mockedPutDelivery.mockResolvedValue({
      deliveryId: "d1",
      tenantId: "t1",
      event: "abandoned_checkout",
      status: "skipped",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("blocks abandoned checkout without marketing opt-in", async () => {
    mockedAssertOutbound.mockRejectedValue(
      new Error("WhatsApp outbound blocked: marketing_opt_in_required")
    );

    const result = await sendShopifyWhatsAppTemplate({
      tenantId: "t1",
      config: baseConfig,
      event: "abandoned_checkout",
      phone: "573001112233",
      variables: { name: "Ana", checkout_url: "https://example.com" },
      environment: "dev",
    });

    expect(result).toBe("skipped");
    expect(mockedSendTemplate).not.toHaveBeenCalled();
    expect(mockedPutDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "abandoned_checkout",
        status: "skipped",
      })
    );
  });

  it("sends transactional order paid templates", async () => {
    const result = await sendShopifyWhatsAppTemplate({
      tenantId: "t1",
      config: baseConfig,
      event: "order_paid",
      phone: "573001112233",
      variables: { name: "Ana", order_number: "#1001" },
      environment: "dev",
    });

    expect(result).toBe("sent");
    expect(mockedAssertOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "transactional",
        requireOptIn: false,
      })
    );
    expect(mockedSendTemplate).toHaveBeenCalled();
  });
});
