import { buildMailrelaySendPayload, ensureMailrelayCampaignHtml, hasMailrelayUnsubscribeLink } from "./campaign.js";

describe("ensureMailrelayCampaignHtml", () => {
  it("detects existing unsubscribe variables", () => {
    expect(hasMailrelayUnsubscribeLink('<a href="{{ unsubscribe_url }}">Baja</a>')).toBe(true);
    expect(hasMailrelayUnsubscribeLink("<a href='%UNSUBSCRIBE%'>Baja</a>")).toBe(true);
  });

  it("appends unsubscribe footer when missing", () => {
    expect(ensureMailrelayCampaignHtml("<p>Hola</p>")).toContain("{{ unsubscribe_url }}");
  });

  it("keeps html unchanged when unsubscribe link exists", () => {
    const html = '<p>Hola</p><a href="{{ unsubscribe_url }}">Baja</a>';
    expect(ensureMailrelayCampaignHtml(html)).toBe(html);
  });
});

describe("buildMailrelaySendPayload", () => {
  it("builds group send payload from campaign", () => {
    expect(
      buildMailrelaySendPayload({
        target: "groups",
        group_ids: [1, 2],
      })
    ).toEqual({
      target: "groups",
      group_ids: [1, 2],
    });
  });

  it("uses override values when provided", () => {
    expect(
      buildMailrelaySendPayload(
        { target: "groups", group_ids: [1] },
        { target: "groups", group_ids: [3] }
      )
    ).toEqual({
      target: "groups",
      group_ids: [3],
    });
  });

  it("requires segment id for segment campaigns", () => {
    expect(() =>
      buildMailrelaySendPayload({
        target: "segment",
      })
    ).toThrow("Campaign segment is missing");
  });
});
