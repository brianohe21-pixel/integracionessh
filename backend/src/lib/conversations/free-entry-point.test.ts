import { shouldOpenFreeEntryPoint } from "../whatsapp/messaging-windows.js";

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

  it("rejects non-CTWA conversations", () => {
    expect(
      shouldOpenFreeEntryPoint(
        {
          attribution: { source: "utm" },
          createdAt: "2026-09-29T10:00:00.000Z",
        },
        "2026-09-29T12:00:00.000Z"
      )
    ).toBe(false);
  });

  it("rejects when already opened", () => {
    expect(
      shouldOpenFreeEntryPoint(
        {
          attribution: { source: "meta_ctwa" },
          createdAt: "2026-09-29T10:00:00.000Z",
          freeEntryPointOpenedAt: "2026-09-29T11:00:00.000Z",
        },
        "2026-09-29T12:00:00.000Z"
      )
    ).toBe(false);
  });

  it("rejects replies after 24h", () => {
    expect(
      shouldOpenFreeEntryPoint(
        {
          attribution: { source: "meta_ctwa" },
          createdAt: "2026-09-28T10:00:00.000Z",
        },
        "2026-09-29T11:00:00.000Z"
      )
    ).toBe(false);
  });
});
