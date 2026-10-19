import {
  isWhatsAppOutboundForCategory,
  parseWhatsAppPricingCategory,
  resolveWhatsAppPricingCategory,
  whatsappCategoryToBucket,
} from "./message-category.js";
import { getCachedTemplate } from "../dynamodb/template.repository.js";
import type { Message } from "../../types/index.js";

jest.mock("../dynamodb/template.repository.js", () => ({
  getCachedTemplate: jest.fn(),
}));

const mockedGetCachedTemplate = getCachedTemplate as jest.MockedFunction<
  typeof getCachedTemplate
>;

function message(overrides: Partial<Message> = {}): Message {
  return {
    messageId: "m1",
    conversationId: "c1",
    tenantId: "tenant",
    role: "assistant",
    content: "hola",
    channel: "whatsapp",
    timestamp: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("parseWhatsAppPricingCategory", () => {
  it("normalizes known categories", () => {
    expect(parseWhatsAppPricingCategory("marketing")).toBe("MARKETING");
    expect(parseWhatsAppPricingCategory("SERVICE")).toBe("SERVICE");
    expect(parseWhatsAppPricingCategory("other")).toBeNull();
  });
});

describe("isWhatsAppOutboundForCategory", () => {
  it("accepts platform outbound and app echo", () => {
    expect(isWhatsAppOutboundForCategory(message({ role: "assistant" }))).toBe(true);
    expect(
      isWhatsAppOutboundForCategory(message({ source: "whatsapp_app_echo", role: "advisor" }))
    ).toBe(true);
    expect(
      isWhatsAppOutboundForCategory(message({ source: "panel", role: "advisor" }))
    ).toBe(true);
  });

  it("rejects inbound and history", () => {
    expect(
      isWhatsAppOutboundForCategory(message({ role: "user", source: "whatsapp_inbound" }))
    ).toBe(false);
    expect(
      isWhatsAppOutboundForCategory(message({ source: "whatsapp_history", role: "assistant" }))
    ).toBe(false);
  });
});

describe("resolveWhatsAppPricingCategory", () => {
  beforeEach(() => {
    mockedGetCachedTemplate.mockReset();
  });

  it("uses stored templateCategory", async () => {
    const category = await resolveWhatsAppPricingCategory(
      message({
        metadata: { kind: "whatsapp_template", templateCategory: "MARKETING" },
      }),
      "bot"
    );
    expect(category).toBe("MARKETING");
    expect(mockedGetCachedTemplate).not.toHaveBeenCalled();
  });

  it("looks up template category when missing from metadata", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
      templateId: "t1",
      tenantId: "tenant",
      botId: "bot",
      name: "promo",
      language: "es",
      category: "AUTHENTICATION",
      status: "APPROVED",
      components: [],
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const category = await resolveWhatsAppPricingCategory(
      message({
        metadata: {
          kind: "whatsapp_template",
          templateName: "promo",
          language: "es",
        },
      }),
      "bot"
    );
    expect(category).toBe("AUTHENTICATION");
  });

  it("counts non-template outbound as SERVICE", async () => {
    const category = await resolveWhatsAppPricingCategory(message({ content: "hola" }), "bot");
    expect(category).toBe("SERVICE");
  });

  it("maps categories to metric buckets", () => {
    expect(whatsappCategoryToBucket("MARKETING")).toBe("marketing");
    expect(whatsappCategoryToBucket("SERVICE")).toBe("service");
  });
});
