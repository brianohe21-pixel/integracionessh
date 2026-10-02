import {
  assertCustomerServiceWindowOpen,
  CustomerServiceWindowClosedError,
  isCustomerServiceWindowOpen,
  resolveLastInboundAtFromMessages,
  shouldOpenFreeEntryPoint,
} from "./messaging-windows.js";

describe("isCustomerServiceWindowOpen", () => {
  const now = Date.parse("2026-09-30T12:00:00.000Z");

  it("returns true for non-whatsapp channels", () => {
    expect(
      isCustomerServiceWindowOpen(
        { channel: "instagram", lastInboundAt: "2026-09-01T00:00:00.000Z" },
        now
      )
    ).toBe(true);
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
