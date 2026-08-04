import {
  buildTelcoredDlrUrl,
  isFinalTelcoredDeliveryCode,
  isIntermediateTelcoredDeliveryCode,
  parseTelcoredDlrQuery,
  parseTelcoredDeliveryCode,
} from "./dlr.js";

describe("sms dlr helpers", () => {
  it("builds Telcored callback URL preserving escape tokens", () => {
    const url = buildTelcoredDlrUrl("receipt-123", "https://api.example.com");

    expect(url).toBe(
      "https://api.example.com/sms/dlr?receiptId=receipt-123&messageId=%i&deliveryCode=%d&sender=%p&recipient=%P&sentAt=%t&cost=%c&status=%s&dlrAt=%y&part=%n&errorCode=%j"
    );
    expect(url).toContain("%i");
    expect(url).toContain("%d");
    expect(url).not.toContain("%25");
  });

  it("parses Telcored callback query params", () => {
    expect(
      parseTelcoredDlrQuery({
        receiptId: "abc",
        messageId: "msg-1",
        deliveryCode: "1",
        sender: "TEST",
        recipient: "573001234567",
        status: "DELIVRD",
      })
    ).toEqual({
      receiptId: "abc",
      messageId: "msg-1",
      deliveryCode: 1,
      sender: "TEST",
      recipient: "573001234567",
      status: "DELIVRD",
    });
  });

  it("accepts legacy estado param as delivery code", () => {
    expect(parseTelcoredDlrQuery({ receiptId: "abc", estado: "16" })?.deliveryCode).toBe(16);
  });

  it("classifies delivery codes", () => {
    expect(parseTelcoredDeliveryCode("4")).toBe(4);
    expect(isIntermediateTelcoredDeliveryCode(4)).toBe(true);
    expect(isFinalTelcoredDeliveryCode(1)).toBe(true);
    expect(isFinalTelcoredDeliveryCode(2)).toBe(true);
    expect(isFinalTelcoredDeliveryCode(16)).toBe(true);
    expect(isFinalTelcoredDeliveryCode(4)).toBe(false);
  });
});
