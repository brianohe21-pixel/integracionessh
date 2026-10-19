import {
  matchesWhatsAppChannelFilter,
  resolveConfiguredWhatsAppChannelIds,
} from "./whatsapp-channel-filter.js";

describe("resolveConfiguredWhatsAppChannelIds", () => {
  it("returns empty for all-numbers mode", () => {
    expect(resolveConfiguredWhatsAppChannelIds({})).toEqual([]);
  });

  it("prefers whatsappChannelIds over legacy id", () => {
    expect(
      resolveConfiguredWhatsAppChannelIds({
        whatsappChannelId: "legacy",
        whatsappChannelIds: ["a", "b", "a"],
      })
    ).toEqual(["a", "b"]);
  });

  it("falls back to legacy whatsappChannelId", () => {
    expect(
      resolveConfiguredWhatsAppChannelIds({ whatsappChannelId: " legacy " })
    ).toEqual(["legacy"]);
  });
});

describe("matchesWhatsAppChannelFilter", () => {
  it("allows any number when no filter is set", () => {
    expect(matchesWhatsAppChannelFilter({}, "ch-1")).toBe(true);
    expect(matchesWhatsAppChannelFilter({}, undefined)).toBe(true);
  });

  it("requires conversation channel when filter is set", () => {
    expect(
      matchesWhatsAppChannelFilter({ whatsappChannelIds: ["ch-1"] }, undefined)
    ).toBe(false);
  });

  it("matches included channel ids", () => {
    expect(
      matchesWhatsAppChannelFilter(
        { whatsappChannelIds: ["ch-1", "ch-2"] },
        "ch-2"
      )
    ).toBe(true);
    expect(
      matchesWhatsAppChannelFilter(
        { whatsappChannelIds: ["ch-1", "ch-2"] },
        "ch-3"
      )
    ).toBe(false);
  });
});
