import {
  buildHistoryWindow,
  mergeDayStatus,
  overallFromComponents,
  statusFromProbe,
  telephonyHealthUrl,
  toUtcDateKey,
  upsertComponentDay,
  worseStatus,
  isSnapshotStale,
  SERVICE_STATUS_HISTORY_DAYS,
  SERVICE_STATUS_STALE_MS,
} from "./aggregate.js";
import { buildPublicServiceStatusResponse } from "./public-response.js";

describe("service-status aggregate", () => {
  it("ranks statuses by severity", () => {
    expect(worseStatus("operational", "degraded")).toBe("degraded");
    expect(worseStatus("degraded", "outage")).toBe("outage");
    expect(worseStatus("unknown", "operational")).toBe("operational");
  });

  it("maps probe results to status levels", () => {
    expect(statusFromProbe(false, 100)).toBe("outage");
    expect(statusFromProbe(true, 2500)).toBe("degraded");
    expect(statusFromProbe(true, 200)).toBe("operational");
  });

  it("merges day statuses keeping the worst outcome", () => {
    expect(mergeDayStatus(undefined, "operational")).toBe("operational");
    expect(mergeDayStatus("operational", "degraded")).toBe("degraded");
    expect(mergeDayStatus("degraded", "outage")).toBe("outage");
    expect(mergeDayStatus("outage", "operational")).toBe("outage");
  });

  it("builds a fixed 90-day window ending on the given day", () => {
    const end = new Date("2026-09-25T12:00:00.000Z");
    const days = buildHistoryWindow(
      [
        { date: "2026-09-25", status: "operational" },
        { date: "2026-09-24", status: "outage" },
      ],
      end
    );

    expect(days).toHaveLength(SERVICE_STATUS_HISTORY_DAYS);
    expect(days[days.length - 1]).toEqual({
      date: "2026-09-25",
      status: "operational",
    });
    expect(days[days.length - 2]).toEqual({
      date: "2026-09-24",
      status: "outage",
    });
    expect(days[0]?.status).toBe("unknown");
    expect(days[0]?.date).toBe(toUtcDateKey(new Date("2026-06-28T00:00:00.000Z")));
  });

  it("upserts a day and trims history to 90 days", () => {
    const end = new Date("2026-09-25T08:00:00.000Z");
    const first = upsertComponentDay([], "2026-09-25", "operational", end);
    const second = upsertComponentDay(first, "2026-09-25", "degraded", end);

    expect(second).toHaveLength(SERVICE_STATUS_HISTORY_DAYS);
    expect(second[second.length - 1]).toEqual({
      date: "2026-09-25",
      status: "degraded",
    });
  });

  it("computes overall status from components", () => {
    expect(
      overallFromComponents([
        { status: "operational" },
        { status: "degraded" },
        { status: "unknown" },
      ])
    ).toBe("degraded");
    expect(overallFromComponents([])).toBe("unknown");
  });

  it("detects stale snapshots", () => {
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    expect(
      isSnapshotStale(new Date(now - SERVICE_STATUS_STALE_MS + 1000).toISOString(), now)
    ).toBe(false);
    expect(
      isSnapshotStale(new Date(now - SERVICE_STATUS_STALE_MS - 1000).toISOString(), now)
    ).toBe(true);
  });

  it("builds telephony health url from websocket url", () => {
    expect(telephonyHealthUrl("wss://voice.example.com/stream")).toBe(
      "https://voice.example.com/health"
    );
    expect(telephonyHealthUrl("")).toBeNull();
    expect(telephonyHealthUrl("not a url")).toBeNull();
  });
});

describe("buildPublicServiceStatusResponse", () => {
  it("marks api operational and data/telephony unknown when snapshot is missing", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    const response = buildPublicServiceStatusResponse(null, now);

    expect(response.stale).toBe(true);
    expect(response.components.map((c) => c.id)).toEqual(["api", "data"]);
    expect(response.components.find((c) => c.id === "api")?.status).toBe("operational");
    expect(response.components.find((c) => c.id === "data")?.status).toBe("unknown");
    expect(response.overall).toBe("unknown");
  });

  it("keeps api operational when snapshot is stale and blanks other components", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    const response = buildPublicServiceStatusResponse(
      {
        updatedAt: "2026-09-25T11:00:00.000Z",
        components: [
          {
            id: "api",
            status: "operational",
            checkedAt: "2026-09-25T11:00:00.000Z",
            days: buildHistoryWindow([]),
          },
          {
            id: "data",
            status: "operational",
            checkedAt: "2026-09-25T11:00:00.000Z",
            days: buildHistoryWindow([]),
          },
          {
            id: "telephony",
            status: "degraded",
            checkedAt: "2026-09-25T11:00:00.000Z",
            days: buildHistoryWindow([]),
          },
        ],
      },
      now
    );

    expect(response.stale).toBe(true);
    expect(response.overall).toBe("unknown");
    expect(response.components.find((c) => c.id === "api")?.status).toBe("operational");
    expect(response.components.find((c) => c.id === "data")?.status).toBe("unknown");
    expect(response.components.find((c) => c.id === "telephony")?.status).toBe("unknown");
  });

  it("reports overall from fresh component statuses", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    const response = buildPublicServiceStatusResponse(
      {
        updatedAt: "2026-09-25T11:55:00.000Z",
        components: [
          {
            id: "data",
            status: "operational",
            checkedAt: "2026-09-25T11:55:00.000Z",
            days: buildHistoryWindow([]),
          },
          {
            id: "telephony",
            status: "degraded",
            checkedAt: "2026-09-25T11:55:00.000Z",
            days: buildHistoryWindow([]),
          },
        ],
      },
      now
    );

    expect(response.stale).toBe(false);
    expect(response.overall).toBe("degraded");
  });
});
