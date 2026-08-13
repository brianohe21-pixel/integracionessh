import {
  buildOpenAISessionUpdate,
  estimateSpeechDrainMs,
  extractResponseText,
  isInboundTelnyxMedia,
  resolveGreeting,
  resolveInstructions,
  TELEPHONY_TTS_DRAIN_TIMEOUT_MS,
  TELEPHONY_TURN_DETECTION,
} from "./bridge.js";
import type { Bot } from "./types.js";

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

  it("does not add a recording notice when it is empty", () => {
    const bot: Bot = {
      botId: "bot-1",
      tenantId: "tenant-1",
      telephonyGreeting: "Hola, ¿en qué puedo ayudarte?",
      telephonyRecordingEnabled: true,
      telephonyRecordingNotice: "",
    };

    expect(resolveGreeting(bot, "es")).toBe("Hola, ¿en qué puedo ayudarte?");
  });

  it("adds a configured recording notice", () => {
    const bot: Bot = {
      botId: "bot-1",
      tenantId: "tenant-1",
      telephonyGreeting: "Hola",
      telephonyRecordingEnabled: true,
      telephonyRecordingNotice: "Esta llamada será grabada.",
    };

    expect(resolveGreeting(bot, "es")).toBe("Esta llamada será grabada. Hola");
  });

  it("removes trailing quote characters from greetings", () => {
    const bot: Bot = {
      botId: "bot-1",
      tenantId: "tenant-1",
      telephonyGreeting: 'Hola, ¿en qué puedo ayudarte?"',
    };

    expect(resolveGreeting(bot, "es")).toBe("Hola, ¿en qué puedo ayudarte?");
  });

  it("instructs the model not to repeat the spoken greeting", () => {
    const bot: Bot = {
      botId: "bot-1",
      tenantId: "tenant-1",
      telephonySystemPrompt: "Atiende el pedido.",
    };

    const instructions = resolveInstructions(bot, "es", "Hola, ¿cómo puedo ayudarte?");

    expect(instructions).toContain("Nunca repitas ni reinicies el saludo inicial");
    expect(instructions).toContain("Hola, ¿cómo puedo ayudarte?");
  });

  it("builds GA OpenAI session.update payload", () => {
    const payload = buildOpenAISessionUpdate({
      model: "gpt-realtime-2.1-mini",
      instructions: "Hola",
      tools: [],
      locale: "es",
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
    expect(
      (session.audio as { input: { turn_detection: typeof TELEPHONY_TURN_DETECTION } }).input
        .turn_detection
    ).toEqual(TELEPHONY_TURN_DETECTION);
    expect(
      (session.audio as { input: { transcription: { language: string } } }).input.transcription
        .language
    ).toBe("es");
  });

  it("estimates speech drain time with bounds", () => {
    expect(estimateSpeechDrainMs(0)).toBe(1_000);
    expect(estimateSpeechDrainMs(285)).toBe(15_675);
    expect(estimateSpeechDrainMs(10_000)).toBe(TELEPHONY_TTS_DRAIN_TIMEOUT_MS);
  });
});
