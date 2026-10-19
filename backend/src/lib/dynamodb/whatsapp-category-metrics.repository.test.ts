import { assembleWhatsAppCategoryReport } from "./whatsapp-category-metrics.repository.js";

describe("assembleWhatsAppCategoryReport", () => {
  const range = { from: "2026-10-01", to: "2026-10-03" };

  it("fills missing days and sums categories", () => {
    const report = assembleWhatsAppCategoryReport(
      [
        {
          SK: "WA_CAT#2026-10-01",
          date: "2026-10-01",
          marketing: 2,
          utility: 5,
          service: 10,
        },
        {
          SK: "WA_CAT#2026-10-03",
          date: "2026-10-03",
          authentication: 1,
          service: 3,
        },
        {
          SK: "WA_CAT#2026-10-01#BOT#bot-a",
          date: "2026-10-01",
          marketing: 99,
        },
      ],
      range
    );

    expect(report.daily).toHaveLength(3);
    expect(report.daily[0]).toMatchObject({
      date: "2026-10-01",
      marketing: 2,
      utility: 5,
      authentication: 0,
      service: 10,
      total: 17,
    });
    expect(report.daily[1]).toMatchObject({ date: "2026-10-02", total: 0 });
    expect(report.totals).toMatchObject({
      marketing: 2,
      utility: 5,
      authentication: 1,
      service: 13,
      total: 21,
    });
    expect(report.byCategory).toEqual([
      { category: "MARKETING", count: 2 },
      { category: "UTILITY", count: 5 },
      { category: "AUTHENTICATION", count: 1 },
      { category: "SERVICE", count: 13 },
    ]);
  });

  it("limits the series to the selected agent", () => {
    const report = assembleWhatsAppCategoryReport(
      [
        {
          SK: "WA_CAT#2026-10-01",
          date: "2026-10-01",
          marketing: 8,
        },
        {
          SK: "WA_CAT#2026-10-01#BOT#bot-a",
          date: "2026-10-01",
          marketing: 2,
          service: 5,
        },
        {
          SK: "WA_CAT#2026-10-02#BOT#bot-b",
          date: "2026-10-02",
          utility: 7,
        },
        {
          SK: "WA_CAT#2026-10-03#BOT#bot-a",
          authentication: 1,
        },
      ],
      range,
      "bot-a"
    );

    expect(report.botId).toBe("bot-a");
    expect(report.daily[0]).toMatchObject({
      date: "2026-10-01",
      marketing: 2,
      service: 5,
      total: 7,
    });
    expect(report.daily[1]).toMatchObject({ date: "2026-10-02", total: 0 });
    expect(report.totals).toMatchObject({
      marketing: 2,
      authentication: 1,
      service: 5,
      total: 8,
    });
  });
});
