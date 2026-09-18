import type { SmsDlrReceipt } from "../../types/index.js";
import { deriveSmsTraceStatus } from "../sms/traceability.js";

const baseReceipt: SmsDlrReceipt = {
  receiptId: "receipt-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  source: "api",
  to: "573001234567",
  metricsApplied: false,
  createdAt: "2026-06-17T12:00:00.000Z",
  updatedAt: "2026-06-17T12:00:00.000Z",
};

describe("sms metrics helpers", () => {
  it("maps delivered status from final delivery code", () => {
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        finalDeliveryCode: 1,
        telcoredMessageId: "msg-1",
      })
    ).toBe("delivered");
  });

  it("maps send_failed from sendError", () => {
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        sendError: "Provider rejected",
      })
    ).toBe("send_failed");
  });

  it("maps delivery_failed from final delivery code 2", () => {
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        finalDeliveryCode: 2,
        telcoredMessageId: "msg-1",
      })
    ).toBe("delivery_failed");
  });
});
