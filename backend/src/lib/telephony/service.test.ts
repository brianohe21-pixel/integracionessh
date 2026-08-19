import { buildTelephonyCallRecord } from "./service.js";

describe("telephony service", () => {
  it("builds telnyx call records with phone channel", () => {
    const record = buildTelephonyCallRecord({
      callId: "call-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      phoneNumber: "+15551234567",
      businessPhoneNumber: "+17871234567",
      direction: "inbound",
      callControlId: "cc-1",
      conversationId: "conv-1",
    });

    expect(record.provider).toBe("telnyx");
    expect(record.channel).toBe("phone");
    expect(record.callControlId).toBe("cc-1");
    expect(record.conversationId).toBe("conv-1");
    expect(record.direction).toBe("USER_INITIATED");
    expect(record.recordingStatus).toBe("disabled");
    expect(record.costStatus).toBe("pending");
  });

  it("marks recording pending when enabled", () => {
    const record = buildTelephonyCallRecord({
      callId: "call-2",
      tenantId: "tenant-1",
      botId: "bot-1",
      phoneNumber: "+15551234567",
      businessPhoneNumber: "+17871234567",
      direction: "outbound",
      callControlId: "cc-2",
      recordingEnabled: true,
    });

    expect(record.recordingStatus).toBe("pending");
  });
});
