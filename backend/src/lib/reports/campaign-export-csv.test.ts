import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { Campaign } from "../../types/index.js";

jest.mock("../dynamodb/campaign.repository.js", () => ({
  getCampaign: jest.fn(),
  listCampaignRecipients: jest.fn(),
}));

jest.mock("../dynamodb/bulk-job.repository.js", () => ({
  listAllBulkSendFailures: jest.fn(),
}));

jest.mock("../dynamodb/campaign-send-attempt.repository.js", () => ({
  listCampaignSendAttempts: jest.fn(),
}));

import { getCampaign, listCampaignRecipients } from "../dynamodb/campaign.repository.js";
import { listCampaignSendAttempts } from "../dynamodb/campaign-send-attempt.repository.js";
import { buildCampaignExportCsv } from "./campaign-export-csv.js";

const mockedGetCampaign = jest.mocked(getCampaign);
const mockedListCampaignRecipients = jest.mocked(listCampaignRecipients);
const mockedListCampaignSendAttempts = jest.mocked(listCampaignSendAttempts);

const baseCampaign: Campaign = {
  campaignId: "camp-123",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Promo Verano",
  channel: "whatsapp",
  templateName: "promo",
  language: "es",
  status: "completed",
  segments: [],
  total: 2,
  sent: 2,
  failed: 0,
  deliveredCount: 1,
  readCount: 0,
  deliveryFailed: 0,
  replyCount: 0,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T11:00:00.000Z",
};

describe("buildCampaignExportCsv", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when campaign is missing", async () => {
    mockedGetCampaign.mockResolvedValue(null);
    const result = await buildCampaignExportCsv("tenant-1", "camp-123");
    expect(result).toBeNull();
  });

  it("builds WhatsApp CSV with attempt rows", async () => {
    mockedGetCampaign.mockResolvedValue(baseCampaign);
    mockedListCampaignSendAttempts.mockResolvedValue([
      {
        attemptId: "sqs-1",
        tenantId: "tenant-1",
        campaignId: "camp-123",
        to: "573001234567",
        channel: "whatsapp",
        status: "delivered",
        templateName: "promo",
        language: "es",
        queuedAt: "2026-08-01T10:00:00.000Z",
        sentAt: "2026-08-01T10:00:01.000Z",
        deliveredAt: "2026-08-01T10:00:05.000Z",
        waMessageId: "wamid.abc",
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-01T10:00:05.000Z",
      },
      {
        attemptId: "sqs-2",
        tenantId: "tenant-1",
        campaignId: "camp-123",
        to: "573001234567",
        channel: "whatsapp",
        status: "send_failed",
        failureKind: "send",
        templateName: "promo",
        language: "es",
        queuedAt: "2026-08-01T09:00:00.000Z",
        failedAt: "2026-08-01T09:00:01.000Z",
        sendErrorMessage: "API error",
        createdAt: "2026-08-01T09:00:00.000Z",
        updatedAt: "2026-08-01T09:00:01.000Z",
      },
    ]);
    mockedListCampaignRecipients.mockResolvedValue([]);

    const result = await buildCampaignExportCsv("tenant-1", "camp-123");
    expect(result).not.toBeNull();
    expect(result!.filename).toMatch(/^campaign-whatsapp-promo-verano-/);
    const lines = result!.content.replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toContain("wa_message_id");
    expect(lines[1]).toContain("send_failed");
    expect(lines[1]).toContain("API error");
    expect(lines[2]).toContain("573001234567");
    expect(lines[2]).toContain("wamid.abc");
    expect(lines[2]).toContain("delivered");
  });

  it("builds SMS CSV with DLR columns", async () => {
    mockedGetCampaign.mockResolvedValue({
      ...baseCampaign,
      channel: "sms",
      requestDlr: true,
    });
    mockedListCampaignSendAttempts.mockResolvedValue([
      {
        attemptId: "sqs-sms-1",
        tenantId: "tenant-1",
        campaignId: "camp-123",
        to: "573009876543",
        channel: "sms",
        status: "delivered",
        templateName: "promo",
        language: "es",
        queuedAt: "2026-08-01T10:00:00.000Z",
        sentAt: "2026-08-01T10:00:01.000Z",
        deliveredAt: "2026-08-01T10:00:10.000Z",
        smsReceiptId: "receipt-1",
        telcoredMessageId: "tel-1",
        finalDeliveryCode: 1,
        cost: "0.02",
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-01T10:00:10.000Z",
      },
    ]);
    mockedListCampaignRecipients.mockResolvedValue([]);

    const result = await buildCampaignExportCsv("tenant-1", "camp-123");
    expect(result).not.toBeNull();
    expect(result!.filename).toMatch(/^campaign-sms-promo-verano-/);
    const lines = result!.content.replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toContain("sms_receipt_id");
    expect(lines[0]).toContain("final_delivery_code");
    expect(lines[1]).toContain("receipt-1");
    expect(lines[1]).toContain("tel-1");
    expect(lines[1]).toContain("true");
  });

  it("escapes CSV special characters", async () => {
    mockedGetCampaign.mockResolvedValue({
      ...baseCampaign,
      name: "Test, Campaign",
    });
    mockedListCampaignSendAttempts.mockResolvedValue([
      {
        attemptId: "sqs-esc",
        tenantId: "tenant-1",
        campaignId: "camp-123",
        to: "573001111111",
        channel: "whatsapp",
        status: "send_failed",
        failureKind: "send",
        templateName: "promo",
        language: "es",
        queuedAt: "2026-08-01T10:00:00.000Z",
        failedAt: "2026-08-01T10:00:01.000Z",
        sendErrorMessage: "Error with comma, and quotes \"bad\"",
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-01T10:00:01.000Z",
      },
    ]);
    mockedListCampaignRecipients.mockResolvedValue([]);

    const result = await buildCampaignExportCsv("tenant-1", "camp-123");
    expect(result!.content).toContain('"Error with comma, and quotes ""bad"""');
  });
});
