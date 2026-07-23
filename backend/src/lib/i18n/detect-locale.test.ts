import { describe, expect, it } from "@jest/globals";
import { detectLocale, resolveConversationLocale } from "./detect-locale.js";

describe("detectLocale", () => {
  it("detects Spanish from accented text", () => {
    expect(detectLocale("Hola, necesito información sobre precios")).toBe("es");
  });

  it("detects English from common words", () => {
    expect(detectLocale("Hello, I need help with my order")).toBe("en");
  });

  it("uses fallback for short ambiguous messages", () => {
    expect(detectLocale("ok", "en")).toBe("en");
    expect(detectLocale("si", "es")).toBe("es");
  });

  it("uses fallback for empty text", () => {
    expect(detectLocale("", "en")).toBe("en");
  });
});

describe("resolveConversationLocale", () => {
  it("prefers conversation locale for ambiguous messages", () => {
    expect(
      resolveConversationLocale({
        userMessage: "ok",
        conversationLocale: "en",
      })
    ).toBe("en");
  });

  it("detects language from clear user message", () => {
    expect(
      resolveConversationLocale({
        userMessage: "I want to schedule an appointment",
        conversationLocale: "es",
      })
    ).toBe("en");
  });
});
