import { getCampaign } from "../dynamodb/campaign.repository.js";
import { sendEmailWithAttachment } from "../email/client.js";
import { buildCampaignExportCsv } from "./campaign-export-csv.js";
import { sendCampaignResultsEmail } from "./send-campaign-results-email.js";

jest.mock("../dynamodb/campaign.repository.js", () => ({
  getCampaign: jest.fn(),
}));

jest.mock("../email/client.js", () => ({
  sendEmailWithAttachment: jest.fn(),
}));

jest.mock("./campaign-export-csv.js", () => ({
  buildCampaignExportCsv: jest.fn(),
}));

const mockedGetCampaign = jest.mocked(getCampaign);
const mockedSendEmail = jest.mocked(sendEmailWithAttachment);
const mockedBuildCsv = jest.mocked(buildCampaignExportCsv);

describe("sendCampaignResultsEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends CSV attachment to normalized recipients", async () => {
    mockedGetCampaign.mockResolvedValue({
      campaignId: "camp-1",
      tenantId: "t1",
      botId: "bot-1",
      name: "Spring promo",
      channel: "whatsapp",
      templateName: "hello",
      language: "es",
      status: "completed",
      segments: [],
      total: 10,
      sent: 9,
      failed: 1,
      deliveredCount: 8,
      readCount: 5,
      deliveryFailed: 0,
      replyCount: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      startedAt: "2026-01-01T01:00:00.000Z",
      completedAt: "2026-01-02T00:00:00.000Z",
    });
    mockedBuildCsv.mockResolvedValue({
      filename: "campaign-whatsapp-spring-promo-2026-01-02.csv",
      content: "campaign_id,phone\ncamp-1,+573001112233",
    });
    mockedSendEmail.mockResolvedValue({ messageId: "msg-1" });

    const result = await sendCampaignResultsEmail({
      tenantId: "t1",
      campaignId: "camp-1",
      to: ["User@Example.com", " user@example.com ", "ops@acme.com"],
    });

    expect(result).toEqual({
      messageId: "msg-1",
      filename: "campaign-whatsapp-spring-promo-2026-01-02.csv",
      recipients: ["user@example.com", "ops@acme.com"],
    });
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com", "ops@acme.com"],
        subject: "Campaign results: Spring promo",
        attachments: [
          expect.objectContaining({
            filename: "campaign-whatsapp-spring-promo-2026-01-02.csv",
            contentType: "text/csv; charset=utf-8",
          }),
        ],
      })
    );
  });

  it("rejects draft campaigns", async () => {
    mockedGetCampaign.mockResolvedValue({
      campaignId: "camp-1",
      tenantId: "t1",
      botId: "bot-1",
      name: "Draft",
      templateName: "hello",
      language: "es",
      status: "draft",
      segments: [],
      total: 0,
      sent: 0,
      failed: 0,
      deliveredCount: 0,
      readCount: 0,
      deliveryFailed: 0,
      replyCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(
      sendCampaignResultsEmail({
        tenantId: "t1",
        campaignId: "camp-1",
        to: ["user@example.com"],
      })
    ).rejects.toThrow("CAMPAIGN_NOT_EXPORTABLE");
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});
