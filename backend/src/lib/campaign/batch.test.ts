import { describe, expect, it } from "@jest/globals";
import {
  campaignBatchScheduleName,
  campaignStartScheduleName,
  computeNextBatchAt,
  estimateBatchCount,
  formatDelaySeconds,
  validateBatchConfig,
  DEFAULT_BATCH_DELAY_SECONDS,
  DEFAULT_BATCH_SIZE,
} from "./batch.js";

describe("validateBatchConfig", () => {
  it("accepts valid config", () => {
    expect(validateBatchConfig({ size: 100, delaySeconds: 300 })).toBeNull();
  });

  it("rejects invalid size", () => {
    expect(validateBatchConfig({ size: 0, delaySeconds: 300 })).toContain("Batch size");
    expect(validateBatchConfig({ size: 1001, delaySeconds: 300 })).toContain("Batch size");
  });

  it("rejects invalid delay", () => {
    expect(validateBatchConfig({ size: 100, delaySeconds: 30 })).toContain("Batch delay");
    expect(validateBatchConfig({ size: 100, delaySeconds: 100_000 })).toContain("Batch delay");
  });
});

describe("estimateBatchCount", () => {
  it("computes batch count", () => {
    expect(estimateBatchCount(250, 100)).toBe(3);
    expect(estimateBatchCount(100, 100)).toBe(1);
    expect(estimateBatchCount(0, 100)).toBe(0);
  });
});

describe("computeNextBatchAt", () => {
  it("adds delay seconds", () => {
    const from = new Date("2026-07-10T12:00:00.000Z");
    const next = computeNextBatchAt(300, from);
    expect(next.toISOString()).toBe("2026-07-10T12:05:00.000Z");
  });
});

describe("schedule names", () => {
  it("uses campaign id prefixes", () => {
    expect(campaignStartScheduleName("abc")).toBe("campaign-abc");
    expect(campaignBatchScheduleName("abc")).toBe("campaign-batch-abc");
  });
});

describe("formatDelaySeconds", () => {
  it("formats minutes and hours", () => {
    expect(formatDelaySeconds(DEFAULT_BATCH_DELAY_SECONDS)).toBe("5m");
    expect(formatDelaySeconds(3600)).toBe("1h");
    expect(formatDelaySeconds(45)).toBe("45s");
  });
});

describe("defaults", () => {
  it("uses expected defaults", () => {
    expect(DEFAULT_BATCH_SIZE).toBe(100);
    expect(DEFAULT_BATCH_DELAY_SECONDS).toBe(300);
  });
});
