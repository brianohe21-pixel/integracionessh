import {
  buildWhatsAppRecipientFields,
  extractWhatsAppIdentityChange,
  isWhatsAppBsuid,
  resolveInboundParticipantId,
  resolveWhatsAppIdentities,
  resolveWhatsAppOutboundRecipient,
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
  it("prefers BSUID when both phone and BSUID are present", () => {
    expect(
      resolveInboundParticipantId(
        { from: "573001234567", from_user_id: "CO.2268328677295906" },
        { wa_id: "573001234567", user_id: "CO.2268328677295906" }
      )
    ).toBe("CO.2268328677295906");
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

describe("resolveWhatsAppIdentities", () => {
  it("uses BSUID as canonical id and keeps phone for lookup", () => {
    expect(
      resolveWhatsAppIdentities(
        {
          from: "573001234567",
          from_user_id: "CO.2268328677295906",
          from_parent_user_id: "US.ENT.11815799212886844830",
        },
        {
          wa_id: "573001234567",
          user_id: "CO.2268328677295906",
          parent_user_id: "US.ENT.11815799212886844830",
          profile: { name: "Ada", username: "ada.lovelace" },
        }
      )
    ).toEqual({
      participantId: "CO.2268328677295906",
      phoneNumber: "573001234567",
      whatsappUserId: "CO.2268328677295906",
      whatsappParentUserId: "US.ENT.11815799212886844830",
      whatsappUsername: "@ada.lovelace",
      lookupIds: [
        "CO.2268328677295906",
        "US.ENT.11815799212886844830",
        "573001234567",
      ],
    });
  });

  it("uses BSUID when phone is unavailable", () => {
    expect(
      resolveWhatsAppIdentities(
        { from_user_id: "CO.2268328677295906" },
        { user_id: "CO.2268328677295906", profile: { name: "Ada", username: "ada" } }
      )
    ).toEqual({
      participantId: "CO.2268328677295906",
      whatsappUserId: "CO.2268328677295906",
      whatsappUsername: "@ada",
      lookupIds: ["CO.2268328677295906"],
    });
  });
});

describe("resolveWhatsAppOutboundRecipient", () => {
  it("prefers BSUID over phone for outbound", () => {
    expect(
      resolveWhatsAppOutboundRecipient({
        participantId: "573001234567",
        phoneNumber: "573001234567",
        whatsappUserId: "CO.2268328677295906",
      })
    ).toBe("CO.2268328677295906");
  });
});

describe("extractWhatsAppIdentityChange", () => {
  it("parses user_changed_user_id system messages", () => {
    expect(
      extractWhatsAppIdentityChange({
        type: "system",
        system: {
          type: "user_changed_user_id",
          previous_user_id: "CO.OLD",
          user_id: "CO.NEW",
          previous_parent_user_id: "US.ENT.OLD",
          parent_user_id: "US.ENT.NEW",
        },
      })
    ).toEqual({
      type: "user_changed_user_id",
      previousUserId: "CO.OLD",
      userId: "CO.NEW",
      previousParentUserId: "US.ENT.OLD",
      parentUserId: "US.ENT.NEW",
    });
  });

  it("parses user_changed_number system messages", () => {
    expect(
      extractWhatsAppIdentityChange({
        type: "system",
        system: {
          type: "user_changed_number",
          previous_wa_id: "+57 300 111 2233",
          wa_id: "573002223344",
          previous_user_id: "CO.OLD",
          user_id: "CO.NEW",
        },
      })
    ).toEqual({
      type: "user_changed_number",
      previousWaId: "573001112233",
      waId: "573002223344",
      previousUserId: "CO.OLD",
      userId: "CO.NEW",
    });
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
