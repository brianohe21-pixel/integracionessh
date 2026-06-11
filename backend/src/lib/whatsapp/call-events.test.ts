import {
  isCallStatusItem,
  normalizeCallConnectEvent,
  normalizeCallStatusEvent,
} from "./call-events.js";

describe("call-events", () => {
  const ctx = { tenantId: "t1", botId: "b1", phoneNumberId: "pn1" };

  it("detects call status items", () => {
    expect(isCallStatusItem({ id: "1", type: "call", status: "RINGING", timestamp: "1", recipient_id: "573" })).toBe(true);
    expect(isCallStatusItem({ id: "1", status: "delivered", timestamp: "1", recipient_id: "573" })).toBe(false);
  });

  it("normalizes connect events", () => {
    const msg = normalizeCallConnectEvent(
      {
        id: "wacid.1",
        event: "connect",
        timestamp: "123",
        from: "573001",
        to: "573002",
        direction: "USER_INITIATED",
        session: { sdp_type: "offer", sdp: "v=0" },
      },
      ctx
    );
    expect(msg.eventType).toBe("connect");
    expect(msg.phoneNumber).toBe("573001");
    expect(msg.session?.sdp_type).toBe("offer");
  });

  it("normalizes status events", () => {
    const msg = normalizeCallStatusEvent(
      {
        id: "wacid.1",
        type: "call",
        status: "ACCEPTED",
        timestamp: "123",
        recipient_id: "573002",
      },
      ctx
    );
    expect(msg.eventType).toBe("status");
    expect(msg.status).toBe("ACCEPTED");
  });
});
