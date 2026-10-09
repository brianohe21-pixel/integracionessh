import { buildNrs360AuthorizationHeader, formatNrs360ScheduleDate } from "./client.js";
import { normalizeNrs360BaseUrl } from "./secrets.js";
import { ensureNrs360CampaignHtml, metricsFromNrs360Campaign } from "./campaign.js";
import { mapNrs360Template, mapNrs360Templates } from "./templates.js";

describe("nrs360 helpers", () => {
  it("builds basic auth header", () => {
    expect(buildNrs360AuthorizationHeader("user", "pass")).toBe(
      `Basic ${Buffer.from("user:pass").toString("base64")}`
    );
  });

  it("normalizes base url", () => {
    expect(normalizeNrs360BaseUrl("dashboard.360nrs.com")).toBe("https://dashboard.360nrs.com");
    expect(normalizeNrs360BaseUrl("https://dashboard.360nrs.com/")).toBe(
      "https://dashboard.360nrs.com"
    );
  });

  it("formats schedule dates in UTC compact form", () => {
    expect(formatNrs360ScheduleDate("2013-02-15T14:20:00.000Z")).toBe("20130215142000");
  });

  it("ensures unsubscribe link for 360nrs", () => {
    expect(ensureNrs360CampaignHtml("<p>Hello</p>")).toContain("[unsubscribe_link]");
    expect(ensureNrs360CampaignHtml('<a href="{{ unsubscribe_url }}">x</a>')).toContain(
      "[unsubscribe_link]"
    );
  });

  it("aggregates mailing campaign metrics", () => {
    const metrics = metricsFromNrs360Campaign({
      sendings: {
        data: [
          {
            stats: {
              sent: 10,
              opened: 4,
              clicked: 2,
              hard_bounced: 1,
              soft_bounced: 1,
              unsubscribed: 1,
              complaint: 0,
            },
          },
        ],
      },
    });
    expect(metrics).toMatchObject({
      sent: 10,
      delivered: 8,
      opened: 4,
      clicked: 2,
      bounced: 2,
      hardBounced: 1,
      softBounced: 1,
      unsubscribed: 1,
    });
  });

  it("maps v2 templates to local shape", () => {
    expect(
      mapNrs360Template({
        id: 334048,
        name: "PRUEBA PLANTILLA AMI",
        type: "HTML",
        html: "<p>Hello</p>",
        createdAt: "2026-10-07T21:05:34+00:00",
        updatedAt: null,
      })
    ).toMatchObject({
      templateId: "334048",
      name: "PRUEBA PLANTILLA AMI",
      subject: "PRUEBA PLANTILLA AMI",
      html: "<p>Hello</p>",
      type: "HTML",
    });
    expect(
      mapNrs360Templates([
        { id: 2, name: "B", html: "b", createdAt: "2026-01-02" },
        { id: 1, name: "A", html: "a", createdAt: "2026-01-01" },
      ]).map((item) => item.templateId)
    ).toEqual(["1", "2"]);
  });
});
