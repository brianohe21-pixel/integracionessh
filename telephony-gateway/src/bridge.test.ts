import {
  buildOpenAISessionUpdate,
  estimateSpeechDrainMs,
  extractResponseText,
  isInboundTelnyxMedia,
  resolveGreeting,
  resolveInstructions,
  shouldAcceptUserTranscript,
  TELEPHONY_BARGE_IN_ECHO_GUARD_MS,
  TELEPHONY_IDLE_REPROMPT_MS,
  TELEPHONY_TTS_DRAIN_TIMEOUT_MS,
  TELEPHONY_TURN_DETECTION,
  ToolResponseCoordinator,
} from "./bridge.js";
import type { Bot } from "./types.js";

describe("telephony bridge", () => {
  it("accepts inbound media and legacy frames without track", () => {
    expect(isInboundTelnyxMedia("inbound")).toBe(true);
    expect(isInboundTelnyxMedia("inbound_track")).toBe(true);
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
    expect(TELEPHONY_TURN_DETECTION.threshold).toBe(0.65);
    expect(TELEPHONY_TURN_DETECTION.interrupt_response).toBe(false);
    expect(TELEPHONY_TURN_DETECTION.silence_duration_ms).toBe(550);
    expect(TELEPHONY_IDLE_REPROMPT_MS).toBe(8_000);
    expect(
      (session.audio as { input: { transcription: { language: string } } }).input.transcription
        .language
    ).toBe("es");
  });

  it("rejects echo transcripts while the agent is speaking", () => {
    expect(
      shouldAcceptUserTranscript({
        transcript: "Joaquín",
        speaking: true,
        speakingStartedAt: 1_000,
        now: 1_000 + TELEPHONY_BARGE_IN_ECHO_GUARD_MS - 1,
      })
    ).toBe(false);
    expect(
      shouldAcceptUserTranscript({
        transcript: "Aeropuerto a Plaza Brasil",
        speaking: true,
        speakingStartedAt: 1_000,
        now: 1_000 + TELEPHONY_BARGE_IN_ECHO_GUARD_MS,
      })
    ).toBe(true);
    expect(
      shouldAcceptUserTranscript({
        transcript: "quiero un taxi",
        speaking: false,
        speakingStartedAt: 0,
        now: 1_000,
      })
    ).toBe(true);
    expect(
      shouldAcceptUserTranscript({
        transcript: "   ",
        speaking: false,
        speakingStartedAt: 0,
        now: 1_000,
      })
    ).toBe(false);
  });

  it("estimates speech drain time with bounds", () => {
    expect(estimateSpeechDrainMs(0)).toBe(1_000);
    expect(estimateSpeechDrainMs(285)).toBe(15_675);
    expect(estimateSpeechDrainMs(10_000)).toBe(TELEPHONY_TTS_DRAIN_TIMEOUT_MS);
  });

  it("requests one response after parallel tools finish", () => {
    const requestResponse = jest.fn();
    const coordinator = new ToolResponseCoordinator(requestResponse);

    coordinator.responseStarted();
    coordinator.toolStarted();
    coordinator.toolStarted();
    coordinator.responseFinished();
    coordinator.toolFinished();

    expect(requestResponse).not.toHaveBeenCalled();

    coordinator.toolFinished();

    expect(requestResponse).toHaveBeenCalledTimes(1);
  });

  it("waits for the active response to finish after tool output", () => {
    const requestResponse = jest.fn();
    const coordinator = new ToolResponseCoordinator(requestResponse);

    coordinator.responseStarted();
    coordinator.toolStarted();
    coordinator.toolFinished();

    expect(requestResponse).not.toHaveBeenCalled();

    coordinator.responseFinished();

    expect(requestResponse).toHaveBeenCalledTimes(1);
  });

  it("does not request another response without tool output", () => {
    const requestResponse = jest.fn();
    const coordinator = new ToolResponseCoordinator(requestResponse);

    coordinator.responseStarted();
    coordinator.responseFinished();

    expect(requestResponse).not.toHaveBeenCalled();
  });
});
