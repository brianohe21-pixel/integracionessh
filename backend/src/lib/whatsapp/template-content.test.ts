import { resolveWhatsAppTemplateDisplayContent } from "./template-content.js";
import { getCachedTemplate } from "../dynamodb/template.repository.js";
import type { WhatsAppTemplate } from "../../types/index.js";

jest.mock("../dynamodb/template.repository.js", () => ({
  getCachedTemplate: jest.fn(),
}));

const mockedGetCachedTemplate = getCachedTemplate as jest.MockedFunction<typeof getCachedTemplate>;

function cachedTemplate(overrides: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate {
  return {
    templateId: "t1",
    tenantId: "tenant",
    botId: "bot",
    name: "hello_world",
    language: "es",
    category: "UTILITY",
    status: "APPROVED",
    components: [{ type: "BODY", text: "Hola {{1}}, pedido {{2}}" }],
    syncedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveWhatsAppTemplateDisplayContent", () => {
  beforeEach(() => {
    mockedGetCachedTemplate.mockReset();
  });

  it("renders cached BODY text with component parameters", async () => {
    mockedGetCachedTemplate.mockResolvedValue(cachedTemplate());

    const resolved = await resolveWhatsAppTemplateDisplayContent({
      tenantId: "tenant",
      botId: "bot",
      templateName: "hello_world",
      language: "es",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Ana" },
            { type: "text", text: "42" },
          ],
        },
      ],
    });

    expect(resolved.content).toBe("Hola Ana, pedido 42");
    expect(resolved.display).toEqual({ bodyText: "Hola Ana, pedido 42" });
  });

  it("renders header, body, footer, and buttons", async () => {
    mockedGetCachedTemplate.mockResolvedValue(
      cachedTemplate({
        components: [
          { type: "HEADER", format: "TEXT", text: "Pedido {{1}}" },
          { type: "BODY", text: "Hola {{1}}, tu pedido está listo" },
          { type: "FOOTER", text: "Gracias por tu compra" },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Ver estado" },
              { type: "URL", text: "Rastrear", url: "https://example.com/{{1}}" },
              { type: "PHONE_NUMBER", text: "Llamar", phone_number: "+573001112233" },
            ],
          },
        ],
      })
    );

    const resolved = await resolveWhatsAppTemplateDisplayContent({
      tenantId: "tenant",
      botId: "bot",
      templateName: "hello_world",
      language: "es",
      components: [
        { type: "header", parameters: [{ type: "text", text: "99" }] },
        { type: "body", parameters: [{ type: "text", text: "Ana" }] },
        {
          type: "button",
          parameters: [{ type: "text", text: "abc" }],
        },
      ],
    });

    expect(resolved.display).toEqual({
      headerText: "Pedido 99",
      bodyText: "Hola Ana, tu pedido está listo",
      footerText: "Gracias por tu compra",
      buttons: ["Ver estado", "Rastrear", "Llamar"],
    });
    expect(resolved.content).toBe(
      [
        "Pedido 99",
        "Hola Ana, tu pedido está listo",
        "Gracias por tu compra",
        "Ver estado\nRastrear\nLlamar",
      ].join("\n\n")
    );
  });

  it("falls back to template name when the template is missing", async () => {
    mockedGetCachedTemplate.mockResolvedValue(null);

    const resolved = await resolveWhatsAppTemplateDisplayContent({
      tenantId: "tenant",
      botId: "bot",
      templateName: "hello_world",
      language: "es",
    });

    expect(resolved).toEqual({ content: "hello_world", display: {} });
  });

  it("renders BODY using templateVariables when components are absent", async () => {
    mockedGetCachedTemplate.mockResolvedValue(
      cachedTemplate({
        name: "welcome",
        category: "MARKETING",
        components: [{ type: "BODY", text: "Bienvenido {{1}}" }],
      })
    );

    const resolved = await resolveWhatsAppTemplateDisplayContent({
      tenantId: "tenant",
      botId: "bot",
      templateName: "welcome",
      language: "es",
      templateVariables: { "1": "Carlos" },
    });

    expect(resolved.content).toBe("Bienvenido Carlos");
    expect(resolved.display).toEqual({ bodyText: "Bienvenido Carlos" });
  });

  it("renders an authentication template with code, footer, and button", async () => {
    mockedGetCachedTemplate.mockResolvedValue(
      cachedTemplate({
        name: "otp_login",
        category: "AUTHENTICATION",
        components: [
          { type: "BODY", add_security_recommendation: true },
          { type: "FOOTER", code_expiration_minutes: 5 },
          { type: "BUTTONS", buttons: [{ type: "OTP", text: "Copiar código", otp_type: "COPY_CODE" }] },
        ],
      })
    );

    const resolved = await resolveWhatsAppTemplateDisplayContent({
      tenantId: "tenant",
      botId: "bot",
      templateName: "otp_login",
      language: "es",
      components: [{ type: "body", parameters: [{ type: "text", text: "482913" }] }],
    });

    expect(resolved.display).toEqual({
      bodyText: "482913 es tu código de verificación. Por tu seguridad, no compartas este código.",
      footerText: "Este código caduca en 5 minutos.",
      buttons: ["Copiar código"],
    });
  });
});
