import { assembleMessageWindowReport } from "./message-window-metrics.repository.js";

describe("assembleMessageWindowReport", () => {
  const range = { from: "2026-10-01", to: "2026-10-03" };

  it("fills missing days and sums inbound and outbound by window", () => {
    const report = assembleMessageWindowReport(
      [
        {
          SK: "MSG_WINDOW#2026-10-01",
          date: "2026-10-01",
          inboundService24h: 4,
          outboundService24h: 2,
          outboundOutsideWindow: 1,
        },
        {
          SK: "MSG_WINDOW#2026-10-03",
          date: "2026-10-03",
          inboundFreeEntry72h: 3,
          outboundFreeEntry72h: 1,
        },
        {
          SK: "MSG_WINDOW#2026-10-01#BOT#bot-a",
          date: "2026-10-01",
          inboundService24h: 99,
        },
      ],
      range
    );

    expect(report.daily).toHaveLength(3);
    expect(report.daily[0]).toMatchObject({
      date: "2026-10-01",
      inboundService24h: 4,
      outboundService24h: 2,
      outboundOutsideWindow: 1,
      total: 7,
    });
    expect(report.daily[1]).toMatchObject({ date: "2026-10-02", total: 0 });
    expect(report.totals).toMatchObject({
      inboundService24h: 4,
      outboundService24h: 2,
      inboundFreeEntry72h: 3,
      outboundFreeEntry72h: 1,
      outboundOutsideWindow: 1,
      inboundOutsideWindow: 0,
      total: 11,
    });
  });

  it("limits the series to the selected agent", () => {
    const report = assembleMessageWindowReport(
      [
        {
          SK: "MSG_WINDOW#2026-10-01",
          date: "2026-10-01",
          outboundService24h: 8,
        },
        {
          SK: "MSG_WINDOW#2026-10-01#BOT#bot-a",
          date: "2026-10-01",
          outboundService24h: 2,
          inboundService24h: 5,
        },
        {
          SK: "MSG_WINDOW#2026-10-02#BOT#bot-b",
          date: "2026-10-02",
          outboundOutsideWindow: 7,
        },
        {
          SK: "MSG_WINDOW#2026-10-03#BOT#bot-a",
          outboundFreeEntry72h: 1,
        },
      ],
      range,
      "bot-a"
    );

    expect(report.botId).toBe("bot-a");
    expect(report.daily[0]).toMatchObject({
      inboundService24h: 5,
      outboundService24h: 2,
      total: 7,
    });
    expect(report.daily[1].total).toBe(0);
    expect(report.daily[2]).toMatchObject({
      outboundFreeEntry72h: 1,
      total: 1,
    });
    expect(report.totals.total).toBe(8);
    expect(report.totals.outboundOutsideWindow).toBe(0);
  });
});
