const getBot = jest.fn();
const incrementBulkJobProgress = jest.fn();
const recordBulkSendFailure = jest.fn();
const saveMessageTracking = jest.fn();
const getContactByPhone = jest.fn();
const sendSmsFromTemplate = jest.fn();
const sendSmsText = jest.fn();
const sendSmsTextWithDlr = jest.fn();
const evaluateLaw2300ForTenant = jest.fn();

jest.mock("../../lib/dynamodb/bot.repository.js", () => ({ getBot }));
jest.mock("../../lib/dynamodb/bulk-job.repository.js", () => ({
  incrementBulkJobProgress,
  parseSendFailureError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
  recordBulkSendFailure,
  saveMessageTracking,
}));
jest.mock("../../lib/whatsapp/client.js", () => ({
  sendTemplateMessage: jest.fn(),
  getWhatsAppAccessToken: jest.fn(),
}));
jest.mock("../../lib/whatsapp/outbound-guard.js", () => ({
  assertWhatsAppOutboundAllowed: jest.fn(),
}));
jest.mock("../../lib/dynamodb/contact.repository.js", () => ({ getContactByPhone }));
jest.mock("../../lib/whatsapp/coexistence/throughput.js", () => ({
  applyCoexistenceSendThrottle: jest.fn(),
}));
jest.mock("../../lib/sms/send-outbound.js", () => ({
  sendSmsFromTemplate,
  sendSmsText,
  sendSmsTextWithDlr,
}));
jest.mock("../../lib/compliance/law2300-tenant.js", () => ({ evaluateLaw2300ForTenant }));

import { handler } from "./index.js";

describe("process-bulk-send SMS free text", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    evaluateLaw2300ForTenant.mockResolvedValue({ allowed: true });
    getBot.mockResolvedValue({
      botId: "bot-1",
      smsEnabled: true,
      smsOriginationNumber: "INFO",
      phoneNumberId: "pn-1",
    });
    getContactByPhone.mockResolvedValue({
      marketingConsent: "opt_in",
      suppressed: false,
    });
    sendSmsTextWithDlr.mockResolvedValue({ messageId: "sms-1", text: "Hola", receiptId: "r-1" });
    saveMessageTracking.mockResolvedValue(undefined);
    incrementBulkJobProgress.mockResolvedValue(undefined);
  });

  it("sends free-text SMS with DLR and bulk source", async () => {
    await handler({
      Records: [
        {
          body: JSON.stringify({
            jobId: "job-1",
            tenantId: "tenant-1",
            botId: "bot-1",
            channel: "sms",
            text: "Hola custom",
            to: "573001234567",
            requireOptIn: true,
          }),
        },
      ],
    } as never);

    expect(sendSmsTextWithDlr).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hola custom",
        source: "bulk",
        to: "573001234567",
      })
    );
    expect(sendSmsFromTemplate).not.toHaveBeenCalled();
    expect(incrementBulkJobProgress).toHaveBeenCalledWith("tenant-1", "job-1", "sent");
  });

  it("rejects free-text on WhatsApp channel", async () => {
    await handler({
      Records: [
        {
          body: JSON.stringify({
            jobId: "job-1",
            tenantId: "tenant-1",
            botId: "bot-1",
            channel: "whatsapp",
            text: "Should fail",
            to: "573001234567",
            requireOptIn: false,
          }),
        },
      ],
    } as never);

    expect(sendSmsTextWithDlr).not.toHaveBeenCalled();
    expect(recordBulkSendFailure).toHaveBeenCalledWith(
      "tenant-1",
      "job-1",
      "send",
      expect.objectContaining({
        errorMessage: "Free-text bulk send is only allowed for SMS",
      })
    );
    expect(incrementBulkJobProgress).toHaveBeenCalledWith("tenant-1", "job-1", "failed");
  });
});
