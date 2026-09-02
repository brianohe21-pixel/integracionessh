import {
  computeNextRunAt,
  sequenceStepScheduleName,
} from "./schedule.js";

describe("sequence schedule", () => {
  it("builds stable schedule names", () => {
    expect(sequenceStepScheduleName("enr-1", 2)).toBe("seq-step-enr-1-2");
  });

  it("computes next run from delay minutes", () => {
    const from = new Date("2026-01-01T10:00:00.000Z");
    expect(computeNextRunAt(30, from)).toBe("2026-01-01T10:30:00.000Z");
  });
});
