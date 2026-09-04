import {
  enrichConversationMessages,
  isDocumentMessageMetadata,
  parseLegacyDocumentFilename,
} from "./document-messages.js";
import { listQuotationsForConversation } from "../dynamodb/quotation.repository.js";
import { getPresignedReadUrl } from "../s3/client.js";

jest.mock("../dynamodb/quotation.repository.js", () => ({
  listQuotationsForConversation: jest.fn(),
}));

jest.mock("../s3/client.js", () => ({
  getPresignedReadUrl: jest.fn(),
}));

const listQuotationsMock = jest.mocked(listQuotationsForConversation);
const getPresignedReadUrlMock = jest.mocked(getPresignedReadUrl);

describe("document message helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPresignedReadUrlMock.mockResolvedValue("https://example.com/file.pdf");
  });

  it("detects document metadata", () => {
    expect(
      isDocumentMessageMetadata({
        kind: "document",
        filename: "COT-20260101-ABC123.pdf",
        mimeType: "application/pdf",
        s3Key: "tenants/t/bots/b/quotations/q.pdf",
      })
    ).toBe(true);
    expect(isDocumentMessageMetadata({ kind: "email" })).toBe(false);
  });

  it("parses legacy document content", () => {
    expect(parseLegacyDocumentFilename("[Documento] COT-20260101-ABC123.pdf")).toBe(
      "COT-20260101-ABC123.pdf"
    );
    expect(parseLegacyDocumentFilename("Hola")).toBeNull();
  });

  it("enriches document messages with download urls", async () => {
    const messages = await enrichConversationMessages(
      [
        {
          messageId: "m-1",
          conversationId: "c-1",
          tenantId: "t-1",
          role: "advisor",
          content: "Cotización COT-20260101-ABC123",
          messageType: "document",
          metadata: {
            kind: "document",
            filename: "COT-20260101-ABC123.pdf",
            mimeType: "application/pdf",
            s3Key: "tenants/t/bots/b/quotations/q.pdf",
          },
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
      { tenantId: "t-1", botId: "b-1" }
    );

    expect(getPresignedReadUrlMock).toHaveBeenCalledWith(
      "tenants/t/bots/b/quotations/q.pdf",
      3600
    );
    expect(messages[0]?.metadata).toMatchObject({
      downloadUrl: "https://example.com/file.pdf",
    });
  });

  it("upgrades legacy document messages using quotation pdf keys", async () => {
    listQuotationsMock.mockResolvedValue([
      {
        quotationId: "q-1",
        tenantId: "t-1",
        botId: "b-1",
        conversationId: "c-1",
        contactPhone: "573001234567",
        number: "COT-20260101-ABC123",
        items: [],
        subtotalInCents: 1000,
        totalInCents: 1000,
        currency: "COP",
        status: "sent",
        pdfS3Key: "tenants/t/bots/b/quotations/q.pdf",
        sentAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const messages = await enrichConversationMessages(
      [
        {
          messageId: "m-legacy",
          conversationId: "c-1",
          tenantId: "t-1",
          role: "advisor",
          content: "[Documento] COT-20260101-ABC123.pdf",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
      { tenantId: "t-1", botId: "b-1" }
    );

    expect(messages[0]?.messageType).toBe("document");
    expect(messages[0]?.metadata).toMatchObject({
      filename: "COT-20260101-ABC123.pdf",
      downloadUrl: "https://example.com/file.pdf",
    });
  });
});
