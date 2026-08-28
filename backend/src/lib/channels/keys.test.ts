import {
  conversationLookupGsi1pk,
  legacyPhoneGsi1pk,
  whatsappConversationLookupGsi1pk,
} from "./keys.js";

describe("channel conversation keys", () => {
  it("builds generic channel lookup keys", () => {
    expect(conversationLookupGsi1pk("tenant-1", "bot-1", "instagram", "user-1")).toBe(
      "TENANT#tenant-1#BOT#bot-1#CHANNEL#instagram#USER#user-1"
    );
  });

  it("builds WhatsApp line-specific lookup keys", () => {
    expect(
      whatsappConversationLookupGsi1pk("tenant-1", "bot-1", "phone-123", "user-1")
    ).toBe("TENANT#tenant-1#BOT#bot-1#CHANNEL#whatsapp#LINE#phone-123#USER#user-1");
  });

  it("keeps legacy phone lookup keys", () => {
    expect(legacyPhoneGsi1pk("tenant-1", "bot-1", "+573001112233")).toBe(
      "TENANT#tenant-1#BOT#bot-1#PHONE#+573001112233"
    );
  });
});
