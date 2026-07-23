import type { Message } from "../../types/index.js";
import {
  buildRagQuery,
  formatConversationHistory,
  normalizeIntent,
} from "./copilot.js";

function message(role: Message["role"], content: string): Message {
  return {
    messageId: "m1",
    conversationId: "c1",
    tenantId: "t1",
    role,
    content,
    timestamp: "2026-01-01T00:00:00.000Z",
  };
}

describe("normalizeIntent", () => {
  it("returns valid intents unchanged", () => {
    expect(normalizeIntent("soporte")).toBe("soporte");
    expect(normalizeIntent("VENTAS")).toBe("ventas");
  });

  it("returns otro for unknown intents", () => {
    expect(normalizeIntent("cancelacion")).toBe("otro");
    expect(normalizeIntent(undefined)).toBe("otro");
  });
});

describe("formatConversationHistory", () => {
  it("formats user and assistant messages", () => {
    const history = formatConversationHistory([
      message("user", "Hola"),
      message("assistant", "Bienvenido"),
      message("system", "ignored"),
    ]);
    expect(history).toContain("Cliente: Hola");
    expect(history).toContain("Asistente/Asesor: Bienvenido");
    expect(history).not.toContain("ignored");
  });
});

describe("buildRagQuery", () => {
  it("uses the last three user messages", () => {
    const query = buildRagQuery([
      message("user", "uno"),
      message("assistant", "resp"),
      message("user", "dos"),
      message("user", "tres"),
      message("user", "cuatro"),
    ]);
    expect(query).toBe("dos\ntres\ncuatro");
  });
});
