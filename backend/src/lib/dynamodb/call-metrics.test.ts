import type { CallRecord } from "../../types/index.js";
import {
  averageDurationSeconds,
  buildCallingMetrics,
  dateRangeFromDays,
  isMissedOutbound,
  isOutboundAttempt,
  isPickedUp,
  isWithinDays,
  pickupHealth,
} from "./call-metrics.js";

function call(overrides: Partial<CallRecord> & Pick<CallRecord, "callId" | "botId">): CallRecord {
  const now = new Date().toISOString();
  return {
    tenantId: "t1",
    phoneNumber: "573000000000",
    direction: "BUSINESS_INITIATED",
    status: "completed",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("call metrics", () => {
  it("counts pickup rate for outbound calls", () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const metrics = buildCallingMetrics(
      [
        call({ callId: "1", botId: "b1", status: "completed", duration: 42, startedAt: recent }),
        call({ callId: "2", botId: "b1", status: "rejected", startedAt: recent }),
        call({ callId: "3", botId: "b1", status: "failed", startedAt: recent }),
        call({
          callId: "4",
          botId: "b1",
          direction: "USER_INITIATED",
          status: "completed",
          duration: 30,
          startedAt: recent,
        }),
      ],
      dateRangeFromDays(7, new Date(now)),
      new Map([["b1", "Bot 1"]])
    );

    expect(metrics.summary.outboundAttempts).toBe(3);
    expect(metrics.summary.outboundPickedUp).toBe(1);
    expect(metrics.summary.outboundMissed).toBe(2);
    expect(metrics.summary.pickupRate).toBe(33.3);
    expect(metrics.summary.inboundCalls).toBe(1);
    expect(metrics.summary.averageDurationSeconds).toBe(36);
    expect(metrics.summary.health).toBe("insufficient_data");
  });

  it("flags at risk when pickup rate is below threshold with enough volume", () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const calls = [
      ...Array.from({ length: 4 }, (_, index) =>
        call({
          callId: `ok-${index}`,
          botId: "b1",
          status: "completed",
          duration: 20,
          startedAt: recent,
        })
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        call({
          callId: `miss-${index}`,
          botId: "b1",
          status: "rejected",
          startedAt: recent,
        })
      ),
    ];
    const metrics = buildCallingMetrics(calls, dateRangeFromDays(7), new Map([["b1", "Bot 1"]]));
    expect(metrics.summary.outboundAttempts).toBe(12);
    expect(metrics.summary.health).toBe("at_risk");
  });

  it("excludes calls outside the window", () => {
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinDays(old, 7)).toBe(false);
    const metrics = buildCallingMetrics(
      [call({ callId: "1", botId: "b1", startedAt: old })],
      dateRangeFromDays(7),
      new Map()
    );
    expect(metrics.summary.totalCalls).toBe(0);
  });

  it("marks health as insufficient_data with few attempts", () => {
    expect(pickupHealth(0, 3)).toBe("insufficient_data");
    expect(pickupHealth(80, 12)).toBe("healthy");
    expect(pickupHealth(40, 12)).toBe("at_risk");
  });

  it("detects picked up calls by duration", () => {
    const picked = call({ callId: "1", botId: "b1", status: "terminated", duration: 10 });
    const missed = call({ callId: "2", botId: "b1", status: "terminated" });
    expect(isPickedUp(picked)).toBe(true);
    expect(isMissedOutbound(missed)).toBe(true);
    expect(isOutboundAttempt(picked)).toBe(true);
    expect(averageDurationSeconds([picked])).toBe(10);
  });
});
