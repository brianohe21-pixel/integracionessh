import {
  bounceKindForStoredMailrelayEvent,
  isMailrelaySuppressionEvent,
  metricFieldsForMailrelayEvent,
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

  it("keeps hard and soft bounces on distinct counters and preserves the payload", () => {
    const input = {
      event_type: "email.bounced",
      bounce_type: "soft",
      campaign_id: 4,
      diagnostic: "mailbox full",
    };
    const event = parseMailrelayWebhook("tenant-1", input);

    expect(event.bounceKind).toBe("soft");
    expect(event.payload).toEqual(expect.objectContaining({ bounce_type: "soft", diagnostic: "mailbox full" }));
    expect(metricFieldsForMailrelayEvent("campaign.hard_bounce")).toEqual(["hardBounced", "bounced"]);
    expect(metricFieldsForMailrelayEvent("soft-bounce")).toEqual(["softBounced", "bounced"]);
    expect(metricFieldsForMailrelayEvent("email.bounced")).toEqual(["bounced"]);
    expect(metricFieldsForMailrelayEvent(event.type, event.payload, event.bounceKind)).toEqual([
      "softBounced",
      "bounced",
    ]);
    expect(input).toEqual({
      event_type: "email.bounced",
      bounce_type: "soft",
      campaign_id: 4,
      diagnostic: "mailbox full",
    });
  });

  it("leaves stored bounce events without a kind as generic", () => {
    expect(bounceKindForStoredMailrelayEvent({ type: "email_bounced" })).toBe("generic");
    expect(
      bounceKindForStoredMailrelayEvent({ type: "email_bounced", bounceKind: "hard" })
    ).toBe("hard");
    expect(bounceKindForStoredMailrelayEvent({ type: "campaign.hard_bounce" })).toBe("hard");
    expect(metricForMailrelayEvent("software_bounce")).toBe("bounced");
  });

  it("compares webhook tokens safely", () => {
    expect(verifyMailrelayWebhookToken("token-123", "token-123")).toBe(true);
    expect(verifyMailrelayWebhookToken("token-124", "token-123")).toBe(false);
    expect(verifyMailrelayWebhookToken(undefined, "token-123")).toBe(false);
  });
});
