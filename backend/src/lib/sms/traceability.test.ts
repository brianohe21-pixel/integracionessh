import type { SmsDlrReceipt } from "../../types/index.js";
import {
  deriveSmsTraceStatus,
  mapSmsDlrReceiptToTraceability,
} from "./traceability.js";

const baseReceipt: SmsDlrReceipt = {
  receiptId: "550e8400-e29b-41d4-a716-446655440000",
  tenantId: "tenant-1",
  botId: "bot-1",
  source: "api",
  to: "573001234567",
  metricsApplied: false,
  createdAt: "2026-06-17T12:00:00.000Z",
  updatedAt: "2026-06-17T12:00:00.000Z",
};

describe("sms traceability", () => {
  it("returns pending before provider acknowledgement", () => {
    expect(deriveSmsTraceStatus(baseReceipt)).toBe("pending");
  });

  it("returns sent after provider message id is stored", () => {
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        telcoredMessageId: "telcored-123",
      })
    ).toBe("sent");
  });

  it("returns delivered for final delivery code 1", () => {
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        telcoredMessageId: "telcored-123",
        finalDeliveryCode: 1,
      })
    ).toBe("delivered");
  });

  it("returns delivery_failed for final delivery codes 2 and 16", () => {
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        telcoredMessageId: "telcored-123",
        finalDeliveryCode: 2,
      })
    ).toBe("delivery_failed");
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        telcoredMessageId: "telcored-123",
        finalDeliveryCode: 16,
      })
    ).toBe("delivery_failed");
  });

  it("returns send_failed when send error is present", () => {
    expect(
      deriveSmsTraceStatus({
        ...baseReceipt,
        sendError: "Telcored API error 401",
      })
    ).toBe("send_failed");
  });

  it("maps receipt fields to API traceability shape", () => {
    const trace = mapSmsDlrReceiptToTraceability({
      ...baseReceipt,
      telcoredMessageId: "telcored-123",
      finalDeliveryCode: 1,
      deliveryStatus: "DELIVRD",
      sentAt: "2026-06-17T12:00:01.000Z",
      dlrAt: "2026-06-17T12:00:05.000Z",
      sender: "msg",
      cost: "0.02",
      part: "1",
    });

    expect(trace).toEqual({
      traceId: baseReceipt.receiptId,
      phone: "573001234567",
      channel: "sms",
      status: "delivered",
      externalMessageId: "telcored-123",
      telcoredMessageId: "telcored-123",
      deliveryStatus: "DELIVRD",
      finalDeliveryCode: 1,
      sentAt: "2026-06-17T12:00:01.000Z",
      deliveredAt: "2026-06-17T12:00:05.000Z",
      dlrAt: "2026-06-17T12:00:05.000Z",
      cost: "0.02",
      part: "1",
      sender: "msg",
      requestDlr: true,
      createdAt: baseReceipt.createdAt,
      updatedAt: baseReceipt.updatedAt,
    });
  });

  it("maps send failures with failure kind and error message", () => {
    const trace = mapSmsDlrReceiptToTraceability({
      ...baseReceipt,
      sendError: "Telcored API error 401",
      updatedAt: "2026-06-17T12:00:02.000Z",
    });

    expect(trace.status).toBe("send_failed");
    expect(trace.failureKind).toBe("send");
    expect(trace.sendErrorMessage).toBe("Telcored API error 401");
    expect(trace.failedAt).toBe("2026-06-17T12:00:02.000Z");
  });
});
