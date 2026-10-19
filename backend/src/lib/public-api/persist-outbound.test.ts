import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { persistPublicApiWhatsAppOutbound } from "./persist-outbound.js";
import {
  addMessage,
  getOrCreateConversation,
} from "../dynamodb/conversation.repository.js";
import { resolveWhatsAppTemplateDisplayContent } from "../whatsapp/template-content.js";

jest.mock("../dynamodb/conversation.repository.js", () => ({
  addMessage: jest.fn(),
  getOrCreateConversation: jest.fn(),
}));

jest.mock("../whatsapp/template-content.js", () => ({
  resolveWhatsAppTemplateDisplayContent: jest.fn(),
}));

const mockedGetOrCreate = getOrCreateConversation as jest.MockedFunction<
  typeof getOrCreateConversation
>;
const mockedAddMessage = addMessage as jest.MockedFunction<typeof addMessage>;
const mockedResolveTemplate = resolveWhatsAppTemplateDisplayContent as jest.MockedFunction<
  typeof resolveWhatsAppTemplateDisplayContent
>;

describe("persistPublicApiWhatsAppOutbound", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetOrCreate.mockResolvedValue({
      conversationId: "conv-1",
      tenantId: "t1",
      botId: "b1",
      channel: "whatsapp",
      participantId: "573001112233",
      status: "active",
      createdAt: "",
      updatedAt: "",
    } as never);
  });

  it("persists text messages into the conversation", async () => {
    await persistPublicApiWhatsAppOutbound({
      tenantId: "t1",
      botId: "b1",
      phoneNumberId: "pn1",
      to: "573001112233",
      externalMessageId: "wamid.1",
      payload: { type: "text", text: "Hola" },
    });

    expect(mockedGetOrCreate).toHaveBeenCalledWith(
      "t1",
      "b1",
      "whatsapp",
      "573001112233",
      undefined,
      {
        businessPhoneNumberId: "pn1",
        phoneNumber: "573001112233",
      }
    );
    expect(mockedAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "wamid.1",
        conversationId: "conv-1",
        role: "assistant",
        content: "Hola",
        channel: "whatsapp",
        externalMessageId: "wamid.1",
        whatsappMessageId: "wamid.1",
        metadata: { origin: "public_api" },
      }),
      "b1"
    );
  });

  it("persists template messages with resolved display content", async () => {
    mockedResolveTemplate.mockResolvedValue({
      content: "Alerta para 2026-10-16",
      display: { bodyText: "Alerta para 2026-10-16" },
      category: "UTILITY",
    });

    await persistPublicApiWhatsAppOutbound({
      tenantId: "t1",
      botId: "b1",
      phoneNumberId: "pn1",
      to: "573001112233",
      externalMessageId: "wamid.2",
      payload: {
        type: "template",
        template: {
          name: "finder_trade",
          language: "es",
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: "2026-10-16" }],
            },
          ],
        },
      },
    });

    expect(mockedResolveTemplate).toHaveBeenCalledWith({
      tenantId: "t1",
      botId: "b1",
      templateName: "finder_trade",
      language: "es",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "2026-10-16" }],
        },
      ],
    });
    expect(mockedAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "wamid.2",
        content: "Alerta para 2026-10-16",
        metadata: expect.objectContaining({
          origin: "public_api",
          kind: "whatsapp_template",
          templateCategory: "UTILITY",
          templateName: "finder_trade",
          language: "es",
        }),
      }),
      "b1"
    );
  });
});
