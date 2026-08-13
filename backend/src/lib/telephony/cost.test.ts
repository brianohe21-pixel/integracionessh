import { estimateTelephonyCost } from "./cost.js";

describe("telephony cost", () => {
  it("estimates total cost from duration and usage", () => {
    const result = estimateTelephonyCost({
      direction: "outbound",
      durationSeconds: 120,
      usage: {
        openaiInputTokens: 1000,
        openaiOutputTokens: 500,
        elevenlabsCharacters: 2000,
      },
      recordingEnabled: true,
      telnyxCostUsd: 0.02,
    });

    expect(result.breakdown.totalUsd).toBeGreaterThan(0);
    expect(result.breakdown.telnyxUsd).toBe(0.02);
    expect(result.breakdown.platformUsd).toBeCloseTo(0.044, 6);
    expect(result.status).toBe("final");
  });

  it("returns pending when no usage or telnyx cost is available", () => {
    const result = estimateTelephonyCost({
      direction: "inbound",
      durationSeconds: 30,
    });

    expect(result.status).toBe("pending");
    expect(result.breakdown.totalUsd).toBeGreaterThan(0);
  });
});
