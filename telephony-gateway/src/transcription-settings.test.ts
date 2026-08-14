import { buildTurnDetection, isBargeInEnabled } from "./transcription-settings.js";
import type { Bot } from "./types.js";

describe("transcription settings", () => {
  const bot: Bot = { botId: "bot-1", tenantId: "tenant-1" };

  it("builds default turn detection", () => {
    const detection = buildTurnDetection(bot);
    expect(detection.threshold).toBe(0.65);
    expect(detection.silence_duration_ms).toBe(550);
    expect(detection.interrupt_response).toBe(false);
  });

  it("applies custom VAD and barge-in settings", () => {
    const detection = buildTurnDetection({
      ...bot,
      telephonyTranscriptionVadThreshold: 0.8,
      telephonyTranscriptionSilenceMs: 800,
      telephonyTranscriptionBargeIn: true,
    });
    expect(detection.threshold).toBe(0.8);
    expect(detection.silence_duration_ms).toBe(800);
    expect(detection.interrupt_response).toBe(true);
    expect(isBargeInEnabled({ ...bot, telephonyTranscriptionBargeIn: true })).toBe(true);
  });
});
