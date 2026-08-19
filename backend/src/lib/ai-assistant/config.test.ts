import type { Bot } from "../../types/index.js";
import {
  assertAiAssistantActive,
  assertCanDisableAiAssistant,
  buildAiAssistantAutoEnableUpdates,
  isAiAssistantEnabled,
  toAiAssistantConfig,
} from "./config.js";

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    botId: "bot-1",
    tenantId: "tenant-1",
    name: "Agent",
    responseMode: "none",
    phoneNumberId: "phone-1",
    whatsappBusinessAccountId: "waba-1",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ai-assistant config", () => {
  it("detects enabled state from responseMode", () => {
    expect(isAiAssistantEnabled(makeBot({ responseMode: "openai" }))).toBe(true);
    expect(isAiAssistantEnabled(makeBot({ responseMode: "none" }))).toBe(false);
    expect(isAiAssistantEnabled(makeBot({ responseMode: "webhook" }))).toBe(false);
  });

  it("maps bot fields to assistant config", () => {
    expect(
      toAiAssistantConfig(
        makeBot({
          responseMode: "openai",
          systemPrompt: "Hello",
          model: "gpt-4.1-mini",
          knowledgeEnabled: true,
        })
      )
    ).toEqual({
      enabled: true,
      systemPrompt: "Hello",
      model: "gpt-4.1-mini",
      knowledgeEnabled: true,
      aiProvider: undefined,
      temperature: undefined,
      maxTokens: undefined,
    });
  });

  it("blocks disable when voice channels are active", () => {
    expect(() =>
      assertCanDisableAiAssistant(makeBot({ voicebotEnabled: true, responseMode: "openai" }))
    ).toThrow("Disable voicebot");
    expect(() =>
      assertCanDisableAiAssistant(makeBot({ telephonyEnabled: true, responseMode: "openai" }))
    ).toThrow("Disable telephony");
  });

  it("requires active assistant for protected features", () => {
    expect(() => assertAiAssistantActive(makeBot({ responseMode: "none" }))).toThrow(
      "AI Assistant is not enabled"
    );
    expect(() => assertAiAssistantActive(makeBot({ responseMode: "openai" }))).not.toThrow();
  });

  it("builds auto-enable updates from telephony prompt", () => {
    expect(
      buildAiAssistantAutoEnableUpdates(
        makeBot({
          responseMode: "none",
          telephonySystemPrompt: "Handle phone calls",
        })
      )
    ).toEqual({
      responseMode: "openai",
      systemPrompt: "Handle phone calls",
      model: "gpt-4.1-mini",
      temperature: 0.7,
      maxTokens: 1024,
    });
    expect(buildAiAssistantAutoEnableUpdates(makeBot({ responseMode: "openai" }))).toEqual({});
  });
});
