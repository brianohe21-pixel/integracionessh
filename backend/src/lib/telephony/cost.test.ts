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
    expect(result.breakdown.elevenlabsUsd).toBe(0.1);
    expect(result.status).toBe("final");
  });

  it("uses the configured ElevenLabs model rate", () => {
    const flash = estimateTelephonyCost({
      direction: "outbound",
      durationSeconds: 60,
      usage: {
        elevenlabsCharacters: 2000,
        elevenlabsModelId: "eleven_flash_v2_5",
      },
    });
    const multilingual = estimateTelephonyCost({
      direction: "outbound",
      durationSeconds: 60,
      usage: {
        elevenlabsCharacters: 2000,
        elevenlabsModelId: "eleven_multilingual_v2",
      },
    });

    expect(flash.breakdown.elevenlabsUsd).toBe(0.1);
    expect(multilingual.breakdown.elevenlabsUsd).toBe(0.2);
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
