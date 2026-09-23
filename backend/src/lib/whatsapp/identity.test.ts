import {
  buildWhatsAppRecipientFields,
  isWhatsAppBsuid,
  resolveInboundParticipantId,
} from "./identity.js";

describe("isWhatsAppBsuid", () => {
  it("accepts standard and parent BSUIDs", () => {
    expect(isWhatsAppBsuid("CO.2268328677295906")).toBe(true);
    expect(isWhatsAppBsuid("US.13491208655302741918")).toBe(true);
    expect(isWhatsAppBsuid("US.ENT.11815799212886844830")).toBe(true);
  });

  it("rejects phone numbers", () => {
    expect(isWhatsAppBsuid("573001234567")).toBe(false);
    expect(isWhatsAppBsuid("+57 300 123 4567")).toBe(false);
  });
});

describe("resolveInboundParticipantId", () => {
  it("prefers phone from when present", () => {
    expect(
      resolveInboundParticipantId(
        { from: "573001234567", from_user_id: "CO.2268328677295906" },
        { wa_id: "573001234567", user_id: "CO.2268328677295906" }
      )
    ).toBe("573001234567");
  });

  it("falls back to from_user_id when phone is omitted", () => {
    expect(
      resolveInboundParticipantId(
        { from_user_id: "CO.2268328677295906" },
        { user_id: "CO.2268328677295906" }
      )
    ).toBe("CO.2268328677295906");
  });

  it("falls back to contact identifiers", () => {
    expect(resolveInboundParticipantId({}, { wa_id: "57300" })).toBe("57300");
    expect(resolveInboundParticipantId({}, { user_id: "CO.1" })).toBe("CO.1");
  });
});

describe("buildWhatsAppRecipientFields", () => {
  it("uses recipient for BSUID", () => {
    expect(buildWhatsAppRecipientFields("CO.2268328677295906")).toEqual({
      recipient: "CO.2268328677295906",
    });
  });

  it("uses digits-only to for phone numbers", () => {
    expect(buildWhatsAppRecipientFields("+57 300 123 4567")).toEqual({
      to: "573001234567",
    });
  });
});
