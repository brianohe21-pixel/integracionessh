import { enrichOpportunity, computeForecastAmount, computeDaysInStage } from "./forecast.js";

describe("sales forecast", () => {
  const base = {
    opportunityId: "opp-1",
    tenantId: "tenant-1",
    pipelineId: "pipe-1",
    stageId: "stage-1",
    title: "Deal",
    currency: "USD",
    stage: "new" as const,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    amount: 1000,
    stageEnteredAt: "2026-01-01T00:00:00.000Z",
  };

  it("computes forecast from stage probability", () => {
    expect(computeForecastAmount(base, { stageId: "s", key: "new", label: "New", sortOrder: 0, probability: 30 })).toBe(300);
  });

  it("enriches opportunity with days in stage", () => {
    const enriched = enrichOpportunity(base, { stageId: "s", key: "new", label: "New", sortOrder: 0, probability: 10 });
    expect(enriched.forecastAmount).toBe(100);
    expect(computeDaysInStage(base.stageEnteredAt, base.createdAt)).toBeGreaterThanOrEqual(0);
  });
});
