import { resolveWhatsAppTemplateDisplayContent } from "./template-content.js";
import { getCachedTemplate } from "../dynamodb/template.repository.js";

jest.mock("../dynamodb/template.repository.js", () => ({
  getCachedTemplate: jest.fn(),
}));

const mockedGetCachedTemplate = getCachedTemplate as jest.MockedFunction<typeof getCachedTemplate>;

describe("resolveWhatsAppTemplateDisplayContent", () => {
  beforeEach(() => {
    mockedGetCachedTemplate.mockReset();
  });

  it("renders cached BODY text with component parameters", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
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
    });

    const content = await resolveWhatsAppTemplateDisplayContent({
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

    expect(content).toBe("Hola Ana, pedido 42");
  });

  it("falls back to template name when BODY is missing", async () => {
    mockedGetCachedTemplate.mockResolvedValue(null);

    const content = await resolveWhatsAppTemplateDisplayContent({
      tenantId: "tenant",
      botId: "bot",
      templateName: "hello_world",
      language: "es",
    });

    expect(content).toBe("hello_world");
  });

  it("renders BODY using templateVariables when components are absent", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
      templateId: "t1",
      tenantId: "tenant",
      botId: "bot",
      name: "welcome",
      language: "es",
      category: "MARKETING",
      status: "APPROVED",
      components: [{ type: "BODY", text: "Bienvenido {{1}}" }],
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const content = await resolveWhatsAppTemplateDisplayContent({
      tenantId: "tenant",
      botId: "bot",
      templateName: "welcome",
      language: "es",
      templateVariables: { "1": "Carlos" },
    });

    expect(content).toBe("Bienvenido Carlos");
  });
});
