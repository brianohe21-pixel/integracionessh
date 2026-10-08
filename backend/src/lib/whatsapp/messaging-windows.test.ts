import {
  assertCustomerServiceWindowOpen,
  classifyWhatsAppMessageWindow,
  CustomerServiceWindowClosedError,
  isCustomerServiceWindowOpen,
  isFreeEntryPointWindowOpen,
  resolveLastInboundAtFromMessages,
  resolveWhatsAppMessageWindowDirection,
  shouldOpenFreeEntryPoint,
} from "./messaging-windows.js";

describe("isCustomerServiceWindowOpen", () => {
  const now = Date.parse("2026-09-30T12:00:00.000Z");

  it("returns true for channels without a messaging window", () => {
    expect(
      isCustomerServiceWindowOpen(
        { channel: "webchat", lastInboundAt: "2026-09-01T00:00:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("enforces the 24h window for Instagram", () => {
    expect(
      isCustomerServiceWindowOpen(
        { channel: "instagram", lastInboundAt: "2026-09-30T10:00:00.000Z" },
        now
      )
    ).toBe(true);
    expect(
      isCustomerServiceWindowOpen(
        { channel: "instagram", lastInboundAt: "2026-09-29T11:59:00.000Z" },
        now
      )
    ).toBe(false);
  });

  it("returns false when lastInboundAt is missing", () => {
    expect(isCustomerServiceWindowOpen({ channel: "whatsapp" }, now)).toBe(false);
  });

  it("returns true within 24h of last inbound", () => {
    expect(
      isCustomerServiceWindowOpen(
        { channel: "whatsapp", lastInboundAt: "2026-09-30T10:00:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("returns false after 24h", () => {
    expect(
      isCustomerServiceWindowOpen(
        { channel: "whatsapp", lastInboundAt: "2026-09-29T11:59:00.000Z" },
        now
      )
    ).toBe(false);
  });
});

describe("resolveLastInboundAtFromMessages", () => {
  it("returns the latest user message timestamp", () => {
    expect(
      resolveLastInboundAtFromMessages([
        {
          role: "assistant",
          timestamp: "2026-09-30T09:00:00.000Z",
        },
        {
          role: "user",
          source: "whatsapp_inbound",
          timestamp: "2026-09-30T11:00:00.000Z",
        },
        {
          role: "advisor",
          timestamp: "2026-09-30T11:30:00.000Z",
        },
      ])
    ).toBe("2026-09-30T11:00:00.000Z");
  });
});

describe("assertCustomerServiceWindowOpen", () => {
  it("throws when closed", () => {
    expect(() =>
      assertCustomerServiceWindowOpen(
        { channel: "whatsapp" },
        Date.parse("2026-09-30T12:00:00.000Z")
      )
    ).toThrow(CustomerServiceWindowClosedError);
  });
});

describe("shouldOpenFreeEntryPoint", () => {
  it("opens for CTWA reply within 24h", () => {
    expect(
      shouldOpenFreeEntryPoint(
        {
          attribution: { source: "meta_ctwa" },
          createdAt: "2026-09-29T10:00:00.000Z",
        },
        "2026-09-29T20:00:00.000Z"
      )
    ).toBe(true);
  });
});

describe("classifyWhatsAppMessageWindow", () => {
  const atMs = Date.parse("2026-10-05T12:00:00.000Z");

  it("counts an outbound message inside the 24h window as service, including templates", () => {
    expect(
      classifyWhatsAppMessageWindow({
        direction: "outbound",
        atMs,
        conversation: {
          lastInboundAt: "2026-10-05T10:00:00.000Z",
        },
      })
    ).toBe("outboundService24h");
  });

  it("counts a template sent with both windows closed as outside the window", () => {
    expect(
      classifyWhatsAppMessageWindow({
        direction: "outbound",
        atMs,
        conversation: {
          lastInboundAt: "2026-10-04T11:00:00.000Z",
        },
      })
    ).toBe("outboundOutsideWindow");
  });

  it("counts the reply that opens the free entry point as its own category", () => {
    expect(
      classifyWhatsAppMessageWindow({
        direction: "outbound",
        atMs,
        opensFreeEntryPoint: true,
        conversation: {
          lastInboundAt: "2026-10-05T11:00:00.000Z",
        },
      })
    ).toBe("outboundFreeEntry72h");
  });

  it("keeps the free entry point category while the 72h window is open", () => {
    expect(
      isFreeEntryPointWindowOpen(
        { freeEntryPointOpenedAt: "2026-10-02T12:00:00.000Z" },
        atMs
      )
    ).toBe(true);
    expect(
      classifyWhatsAppMessageWindow({
        direction: "outbound",
        atMs,
        conversation: {
          lastInboundAt: "2026-10-05T11:00:00.000Z",
          freeEntryPointOpenedAt: "2026-10-03T12:00:00.000Z",
        },
      })
    ).toBe("outboundFreeEntry72h");
  });

  it("falls back to the 24h window after the free entry point expires", () => {
    expect(
      classifyWhatsAppMessageWindow({
        direction: "outbound",
        atMs,
        conversation: {
          lastInboundAt: "2026-10-05T10:00:00.000Z",
          freeEntryPointOpenedAt: "2026-10-02T11:00:00.000Z",
        },
      })
    ).toBe("outboundService24h");
  });

  it("counts inbound messages in the open free entry point separately from service", () => {
    expect(
      classifyWhatsAppMessageWindow({
        direction: "inbound",
        atMs,
        conversation: {
          freeEntryPointOpenedAt: "2026-10-04T12:00:00.000Z",
        },
      })
    ).toBe("inboundFreeEntry72h");
  });

  it("counts an inbound message that opens a closed window as service 24h", () => {
    expect(
      classifyWhatsAppMessageWindow({
        direction: "inbound",
        atMs,
        conversation: null,
      })
    ).toBe("inboundService24h");
  });
});

describe("resolveWhatsAppMessageWindowDirection", () => {
  it("ignores history and non-whatsapp messages", () => {
    expect(
      resolveWhatsAppMessageWindowDirection({
        channel: "whatsapp",
        source: "whatsapp_history",
        role: "user",
      })
    ).toBeNull();
    expect(
      resolveWhatsAppMessageWindowDirection({
        channel: "instagram",
        source: "instagram_inbound",
        role: "user",
      })
    ).toBeNull();
  });

  it("maps customer messages to inbound and business messages to outbound", () => {
    expect(
      resolveWhatsAppMessageWindowDirection({
        channel: "whatsapp",
        source: "whatsapp_inbound",
        role: "user",
      })
    ).toBe("inbound");
    expect(
      resolveWhatsAppMessageWindowDirection({
        channel: "whatsapp",
        source: "whatsapp_app_echo",
        role: "advisor",
      })
    ).toBe("outbound");
  });
});
