import { buildOpenAISessionUpdate, extractResponseText, isInboundTelnyxMedia } from "./bridge.js";

describe("telephony bridge", () => {
  it("accepts inbound media and legacy frames without track", () => {
    expect(isInboundTelnyxMedia("inbound")).toBe(true);
    expect(isInboundTelnyxMedia(undefined)).toBe(true);
  });

  it("ignores outbound media echoes", () => {
    expect(isInboundTelnyxMedia("outbound")).toBe(false);
  });

  it("extracts assistant text from GA response.done payload", () => {
    const text = extractResponseText({
      output: [
        {
          content: [{ type: "output_text", text: "Hola, ¿en qué puedo ayudarte?" }],
        },
      ],
    });
    expect(text).toBe("Hola, ¿en qué puedo ayudarte?");
  });

  it("builds GA OpenAI session.update payload", () => {
    const payload = buildOpenAISessionUpdate({
      model: "gpt-realtime-2.1-mini",
      instructions: "Hola",
      tools: [],
    });

    expect(payload.type).toBe("session.update");
    const session = payload.session as Record<string, unknown>;
    expect(session.type).toBe("realtime");
    expect(session.output_modalities).toEqual(["text"]);
    expect(session.modalities).toBeUndefined();
    expect(session.input_audio_format).toBeUndefined();
    expect((session.audio as { input: { format: { type: string } } }).input.format.type).toBe(
      "audio/pcmu"
    );
  });
});
