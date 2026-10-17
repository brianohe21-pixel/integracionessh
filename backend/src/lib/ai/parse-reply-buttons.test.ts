import {
  formatAiButtonsFallbackText,
  parseAiReplyButtons,
} from "./parse-reply-buttons.js";

describe("parseAiReplyButtons", () => {
  it("returns plain text when there is no buttons block", () => {
    const result = parseAiReplyButtons("Hola, ¿en qué te ayudo?");
    expect(result).toEqual({
      body: "Hola, ¿en qué te ayudo?",
      buttons: [],
    });
  });

  it("extracts body and up to three buttons", () => {
    const result = parseAiReplyButtons(`¿Te gustaría ver una demo o hablar con ventas?

[[buttons]]
Demo
Ventas
Soporte
Extra
[[/buttons]]`);

    expect(result.body).toBe("¿Te gustaría ver una demo o hablar con ventas?");
    expect(result.buttons).toEqual([
      { id: "ai-btn-1", title: "Demo" },
      { id: "ai-btn-2", title: "Ventas" },
      { id: "ai-btn-3", title: "Soporte" },
    ]);
  });

  it("truncates titles to 20 characters and skips empty lines", () => {
    const result = parseAiReplyButtons(`Elige:

[[buttons]]

Solicitar una demostracion extendida

Hablar con ventas
[[/buttons]]`);

    expect(result.buttons).toEqual([
      { id: "ai-btn-1", title: "Solicitar una demost" },
      { id: "ai-btn-2", title: "Hablar con ventas" },
    ]);
  });

  it("treats invalid or empty blocks as text without buttons", () => {
    const empty = parseAiReplyButtons(`Hola

[[buttons]]

[[/buttons]]`);
    expect(empty.buttons).toEqual([]);
    expect(empty.body).toBe("Hola");

    const noClose = parseAiReplyButtons("Hola [[buttons]]\nDemo");
    expect(noClose.buttons).toEqual([]);
    expect(noClose.body).toContain("[[buttons]]");
  });

  it("is case-insensitive for block markers", () => {
    const result = parseAiReplyButtons(`Menu

[[BUTTONS]]
A
B
[[/BUTTONS]]`);
    expect(result.body).toBe("Menu");
    expect(result.buttons.map((b) => b.title)).toEqual(["A", "B"]);
  });
});

describe("formatAiButtonsFallbackText", () => {
  it("appends numbered options for non-WhatsApp channels", () => {
    expect(
      formatAiButtonsFallbackText("Elige una opción:", [
        { id: "ai-btn-1", title: "Demo" },
        { id: "ai-btn-2", title: "Ventas" },
      ])
    ).toBe("Elige una opción:\n\n1. Demo\n2. Ventas");
  });

  it("returns only options when body is empty", () => {
    expect(
      formatAiButtonsFallbackText("", [{ id: "ai-btn-1", title: "Demo" }])
    ).toBe("1. Demo");
  });
});
