const getBot = jest.fn();
const getCampaign = jest.fn();
const incrementCampaignProgress = jest.fn();
const markRecipientSent = jest.fn();
const markRecipientFailed = jest.fn();
const saveCampaignMessageTracking = jest.fn();
const ensureCampaignSendAttempt = jest.fn();
const isCampaignSendAttemptTerminal = jest.fn();
const markCampaignSendAttemptFailed = jest.fn();
const markCampaignSendAttemptSent = jest.fn();
const deleteCampaignSendAttempt = jest.fn();
const getContactByPhone = jest.fn();
const sendSmsFromTemplate = jest.fn();
const sendSmsText = jest.fn();
const sendSmsTextWithDlr = jest.fn();
const evaluateLaw2300ForTenant = jest.fn();
const saveBulkSendFailure = jest.fn();
const parseSendFailureError = jest.fn((error: unknown) => ({
  errorMessage: error instanceof Error ? error.message : String(error),
}));

jest.mock("../../lib/dynamodb/bot.repository.js", () => ({ getBot }));
jest.mock("../../lib/dynamodb/campaign.repository.js", () => ({
  getCampaign,
  incrementCampaignProgress,
  markRecipientSent,
  markRecipientFailed,
  saveCampaignMessageTracking,
  listPendingRecipients: jest.fn(),
  setCampaignNextBatchAt: jest.fn(),
}));
jest.mock("../../lib/dynamodb/bulk-job.repository.js", () => ({
  parseSendFailureError,
  saveBulkSendFailure,
}));
jest.mock("../../lib/dynamodb/campaign-send-attempt.repository.js", () => ({
  ensureCampaignSendAttempt,
  isCampaignSendAttemptTerminal,
  markCampaignSendAttemptFailed,
  markCampaignSendAttemptSent,
  deleteCampaignSendAttempt,
}));
jest.mock("../../lib/dynamodb/contact.repository.js", () => ({ getContactByPhone }));
jest.mock("../../lib/whatsapp/client.js", () => ({
  sendTemplateMessage: jest.fn(),
  getWhatsAppAccessToken: jest.fn(),
}));
jest.mock("../../lib/whatsapp/outbound-guard.js", () => ({
  assertWhatsAppOutboundAllowed: jest.fn(),
}));
jest.mock("../../lib/whatsapp/coexistence/throughput.js", () => ({
  applyCoexistenceSendThrottle: jest.fn(),
}));
jest.mock("../../lib/sms/send-outbound.js", () => ({
  sendSmsFromTemplate,
  sendSmsText,
  sendSmsTextWithDlr,
}));
jest.mock("../../lib/campaign/batch.js", () => ({
  computeNextBatchAt: jest.fn(),
}));
jest.mock("../../lib/campaign/scheduler.js", () => ({
  createCampaignBatchSchedule: jest.fn(),
  deleteCampaignBatchSchedule: jest.fn(),
}));
jest.mock("../../lib/compliance/law2300-tenant.js", () => ({ evaluateLaw2300ForTenant }));
jest.mock("../../lib/compliance/law2300-campaign.js", () => ({
  deferCampaignDispatchForLaw2300: jest.fn(),
  resolveLaw2300AwareRunAt: jest.fn(),
}));
jest.mock("../../lib/compliance/audit-log.js", () => ({ writeComplianceLog: jest.fn() }));

import { handler } from "./index.js";

describe("process-campaign SMS free text", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    evaluateLaw2300ForTenant.mockResolvedValue({ allowed: true });
    getCampaign.mockResolvedValue({
      campaignId: "camp-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      status: "running",
      channel: "sms",
      messageMode: "free_text",
      templateName: "(custom)",
      language: "und",
      text: "Hola desde campaña",
      requireOptIn: false,
      requestDlr: true,
    });
    getBot.mockResolvedValue({
      botId: "bot-1",
      smsEnabled: true,
      smsOriginationNumber: "INFO",
      phoneNumberId: "pn-1",
    });
    ensureCampaignSendAttempt.mockResolvedValue({
      attempt: { status: "queued" },
      isNew: true,
    });
    isCampaignSendAttemptTerminal.mockReturnValue(false);
    sendSmsTextWithDlr.mockResolvedValue({
      messageId: "sms-1",
      text: "Hola desde campaña",
      receiptId: "r-1",
    });
    markCampaignSendAttemptSent.mockResolvedValue(undefined);
    saveCampaignMessageTracking.mockResolvedValue(undefined);
    markRecipientSent.mockResolvedValue(true);
    incrementCampaignProgress.mockResolvedValue(undefined);
  });

  it("sends free-text SMS for campaign recipients", async () => {
    await handler({
      Records: [
        {
          messageId: "attempt-1",
          body: JSON.stringify({
            kind: "recipient",
            campaignId: "camp-1",
            tenantId: "tenant-1",
            botId: "bot-1",
            channel: "sms",
            text: "Hola desde campaña",
            to: "573001234567",
            recipientKey: "CAMPREC#camp-1#0",
            requestDlr: true,
            requireOptIn: false,
          }),
        },
      ],
    } as never);

    expect(sendSmsTextWithDlr).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hola desde campaña",
        source: "campaign",
        campaignId: "camp-1",
        attemptId: "attempt-1",
        recipientKey: "CAMPREC#camp-1#0",
        to: "573001234567",
      })
    );
    expect(sendSmsFromTemplate).not.toHaveBeenCalled();
    expect(incrementCampaignProgress).toHaveBeenCalledWith("tenant-1", "camp-1", "sent");
  });
});
