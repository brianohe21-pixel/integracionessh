import {
  isMailrelaySuppressionEvent,
  metricForMailrelayEvent,
  parseMailrelayWebhook,
  verifyMailrelayWebhookToken,
} from "./webhook.js";

describe("Mailrelay webhook parsing", () => {
  it("accepts additional fields and extracts nested identifiers", () => {
    const event = parseMailrelayWebhook("tenant-1", {
      event_id: "evt-1",
      event_type: "subscriber.unsubscribed",
      sent_campaign: { id: 42 },
      subscriber: { id: 7, email: "USER@EXAMPLE.COM" },
      future_field: { value: true },
    });

    expect(event).toEqual(
      expect.objectContaining({
        eventId: "evt-1",
        tenantId: "tenant-1",
        type: "subscriber.unsubscribed",
        campaignId: 42,
        subscriberId: 7,
        email: "user@example.com",
      })
    );
  });

  it("uses stable hashes when an event id is absent", () => {
    const payload = { event: "opened", campaign_id: 9 };
    expect(parseMailrelayWebhook("tenant-1", payload).eventId).toBe(
      parseMailrelayWebhook("tenant-1", payload).eventId
    );
  });

  it("maps metrics and suppression events", () => {
    expect(metricForMailrelayEvent("campaign.impression")).toBe("opened");
    expect(metricForMailrelayEvent("subscriber.unsubscribe")).toBe("unsubscribed");
    expect(isMailrelaySuppressionEvent("subscriber.unsubscribe")).toBe(true);
    expect(isMailrelaySuppressionEvent("campaign.clicked")).toBe(false);
  });

  it("compares webhook tokens safely", () => {
    expect(verifyMailrelayWebhookToken("token-123", "token-123")).toBe(true);
    expect(verifyMailrelayWebhookToken("token-124", "token-123")).toBe(false);
    expect(verifyMailrelayWebhookToken(undefined, "token-123")).toBe(false);
  });
});
