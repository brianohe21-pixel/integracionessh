import {
  buildMailrelayDeliverabilityFromMetrics,
  buildMailrelayDeliverabilityReport,
  parseMailrelayDeliverabilityRange,
  presentMailrelayBounceCounts,
} from "./deliverability.js";
import type { MailrelayCampaignMetrics } from "../../types/index.js";

function metrics(overrides: Partial<MailrelayCampaignMetrics>): MailrelayCampaignMetrics {
  return {
    tenantId: "tenant-1",
    campaignId: 1,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    hardBounced: 0,
    softBounced: 0,
    genericBounced: 0,
    unsubscribed: 0,
    complained: 0,
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Mailrelay deliverability", () => {
  it("keeps historical bounces without a kind as generic", () => {
    expect(presentMailrelayBounceCounts({ bounced: 5 })).toEqual({
      bounced: 5,
      hardBounced: 0,
      softBounced: 0,
      genericBounced: 5,
    });
    expect(presentMailrelayBounceCounts({ bounced: 5, hardBounced: 2, softBounced: 1 })).toEqual({
      bounced: 5,
      hardBounced: 2,
      softBounced: 1,
      genericBounced: 2,
    });
  });

  it("aggregates hard, soft and generic bounces per campaign and day", () => {
    const report = buildMailrelayDeliverabilityReport({
      from: "2026-10-01",
      to: "2026-10-03",
      names: new Map([[1, "Newsletter"]]),
      events: [
        {
          type: "campaign.hard_bounce",
          occurredAt: "2026-10-01T10:00:00.000Z",
          campaignId: 1,
          bounceKind: "hard",
        },
        {
          type: "campaign.soft_bounce",
          occurredAt: "2026-10-01T11:00:00.000Z",
          campaignId: 1,
          bounceKind: "soft",
        },
        {
          type: "email.opened",
          occurredAt: "2026-10-01T12:00:00.000Z",
          campaignId: 1,
        },
        {
          type: "email_bounced",
          occurredAt: "2026-10-02T08:00:00.000Z",
          campaignId: 2,
        },
        {
          type: "subscriber.complaint",
          occurredAt: "2026-10-02T09:00:00.000Z",
          campaignId: 1,
        },
        {
          type: "opened",
          occurredAt: "2026-09-01T09:00:00.000Z",
          campaignId: 1,
        },
      ],
    });

    expect(report.totals).toEqual(
      expect.objectContaining({
        opened: 1,
        hardBounced: 1,
        softBounced: 1,
        genericBounced: 1,
        bounced: 3,
        complained: 1,
      })
    );
    expect(report.totals.bounced).toBe(
      report.totals.hardBounced + report.totals.softBounced + report.totals.genericBounced
    );
    expect(report.campaigns.map((row) => row.campaignId)).toEqual([1, 2]);
    expect(report.campaigns[0]?.name).toBe("Newsletter");
    expect(report.campaigns[1]?.genericBounced).toBe(1);
    expect(report.campaigns[1]?.hardBounced).toBe(0);
    expect(report.daily).toHaveLength(3);
    expect(report.daily[0]).toEqual(
      expect.objectContaining({ date: "2026-10-01", hardBounced: 1, softBounced: 1, opened: 1 })
    );
    expect(report.campaigns[0]?.daily[1]).toEqual(
      expect.objectContaining({ date: "2026-10-02", complained: 1, bounced: 0 })
    );
  });

  it("builds lifetime totals without reclassifying stored generic bounces", () => {
    const report = buildMailrelayDeliverabilityFromMetrics({
      metrics: [
        metrics({ campaignId: 7, sent: 10, bounced: 4, hardBounced: 1, softBounced: 1 }),
      ],
    });

    expect(report.from).toBeNull();
    expect(report.daily).toEqual([]);
    expect(report.campaigns[0]).toEqual(
      expect.objectContaining({
        campaignId: 7,
        name: "#7",
        sent: 10,
        hardBounced: 1,
        softBounced: 1,
        genericBounced: 2,
        bounced: 4,
      })
    );
  });

  it("rejects ranges longer than 90 days", () => {
    expect(parseMailrelayDeliverabilityRange("2026-01-01", "2026-05-01").ok).toBe(false);
    expect(parseMailrelayDeliverabilityRange("2026-10-03", "2026-10-01")).toEqual({
      ok: true,
      from: "2026-10-01",
      to: "2026-10-03",
    });
  });
});
