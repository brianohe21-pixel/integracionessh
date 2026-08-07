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
  });
});
