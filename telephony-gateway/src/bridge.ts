import { randomUUID } from "crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import WebSocket, { type RawData } from "ws";
import { BackgroundSoundEngine } from "./background-audio.js";
import {
  fetchBackgroundSoundLoop,
  resolveBackgroundSoundId,
  resolveBackgroundSoundVolume,
} from "./background-sounds.js";
import { isCalendarEnabled } from "./calendar.js";
import { docClient, tableName } from "./dynamo.js";
import { persistPhoneMessage } from "./messages.js";
import { getElevenLabsApiKey, getOpenAIApiKey } from "./secrets.js";
import {
  buildRealtimeTools,
  executeTelephonyTool,
  fetchVoiceRuntime,
  parseToolExecutionResult,
  reportCallUsage,
  reportToolExecution,
} from "./tools.js";
import { resolveTelephonyTranscriptionModelId } from "./transcription-models.js";
import {
  buildTurnDetection,
  isBargeInEnabled,
  type TelephonyTurnDetection,
} from "./transcription-settings.js";
import { resolveTtsModel, resolveVoiceSettings } from "./voice-settings.js";
import type { Bot, TelephonySession } from "./types.js";

type OpenAIEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  event_id?: string;
  item_id?: string;
  error?: {
    type?: string;
    code?: string;
    message?: string;
  };
  response?: {
    id?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };
};

type TelnyxInboundEvent = {
  event?: string;
  stream_id?: string;
  start?: { stream_id?: string };
  media?: { payload?: string; track?: string };
};

export function extractResponseText(response?: OpenAIEvent["response"]): string {
  if (!response?.output) return "";
  return response.output
    .flatMap((item) => item.content ?? [])
    .filter((part) => (part.type === "text" || part.type === "output_text") && part.text)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export class ToolResponseCoordinator {
  private pendingTools = 0;
  private responseActive = false;
  private responseRequired = false;

  constructor(private readonly requestResponse: () => void) {}

  responseStarted(): void {
    this.responseActive = true;
  }

  responseFinished(): void {
    this.responseActive = false;
    this.flush();
  }

  toolStarted(): void {
    this.pendingTools += 1;
    this.responseActive = true;
    this.responseRequired = true;
  }

  toolFinished(): void {
    this.pendingTools = Math.max(0, this.pendingTools - 1);
    this.flush();
  }

  hasActiveResponse(): boolean {
    return this.responseActive;
  }

  private flush(): void {
    if (!this.responseRequired || this.responseActive || this.pendingTools > 0) return;
    this.responseRequired = false;
    this.responseActive = true;
    this.requestResponse();
  }
}

async function getBot(tenantId: string, botId: string): Promise<Bot | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `BOT#${botId}`,
      },
    })
  );
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as Bot;
}

function resolveVoiceId(bot: Bot): string {
  return bot.telephonyVoiceId?.trim() || "EXAVITQu4vr4xnSDxMaL";
}

function resolveModel(bot: Bot): string {
  const model = bot.telephonyModel ?? bot.voicebotModel;
  if (model?.startsWith("gpt-realtime")) return model;
  return "gpt-realtime-2.1-mini";
}

function resolveTranscriptionModel(bot: Bot): string {
  return resolveTelephonyTranscriptionModelId(bot.telephonyTranscriptionModel);
}

export function resolveInstructions(
  bot: Bot,
  locale: TelephonySession["locale"],
  greeting: string
): string {
  const base =
    bot.telephonySystemPrompt?.trim() ||
    bot.voicebotSystemPrompt?.trim() ||
    bot.systemPrompt?.trim() ||
    "";
  const language =
    locale === "en"
      ? "Always respond in English."
      : "Responde siempre en español.";
  const handoffEnabled = Boolean(bot.telephonyHandoffEnabled);
  const handoffInstruction = handoffEnabled
    ? ""
    : locale === "en"
      ? "\n\nNever transfer or offer to transfer the call to a human advisor."
      : "\n\nNunca transfieras ni ofrezcas pasar la llamada a un asesor humano.";
  const greetingInstruction =
    locale === "en"
      ? `\n\nThe caller has already heard this opening greeting: "${greeting}". Never repeat or restart the opening greeting. Respond directly to what the caller says next.`
      : `\n\nLa persona ya escuchó este saludo inicial: "${greeting}". Nunca repitas ni reinicies el saludo inicial. Responde directamente a lo próximo que diga la persona.`;
  return `${base}\n\n${language}${handoffInstruction}${greetingInstruction}`;
}

export function resolveGreeting(bot: Bot, locale: TelephonySession["locale"]): string {
  const greeting = bot.telephonyGreeting?.trim() || bot.voicebotGreeting?.trim();
  const text = (
    greeting ||
    (locale === "en"
      ? "Hello! How can I help you today?"
      : "Hola, ¿en qué puedo ayudarte?")
  )
    .replace(/["“”]+$/u, "")
    .trim();
  const notice = bot.telephonyRecordingNotice?.trim();
  if (bot.telephonyRecordingEnabled && notice) return `${notice} ${text}`;
  return text;
}

export function isInboundTelnyxMedia(track?: string): boolean {
  if (!track) return true;
  return track === "inbound" || track === "inbound_track";
}

export function buildOpenAISessionUpdate(params: {
  model: string;
  transcriptionModel: string;
  instructions: string;
  tools: Array<Record<string, unknown>>;
  locale: TelephonySession["locale"];
  turnDetection: TelephonyTurnDetection;
}): Record<string, unknown> {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      model: params.model,
      instructions: params.instructions,
      tools: params.tools,
      tool_choice: "auto",
      output_modalities: ["text"],
      audio: {
        input: {
          format: { type: "audio/pcmu" },
          turn_detection: params.turnDetection,
          transcription: {
            model: params.transcriptionModel,
            language: params.locale,
          },
        },
      },
    },
  };
}

const FATAL_ELEVENLABS_ERRORS = new Set([
  "payment_required",
  "missing_permissions",
  "invalid_api_key",
  "voice_not_found",
  "quota_exceeded",
]);

export function isFatalElevenLabsError(error: string): boolean {
  return FATAL_ELEVENLABS_ERRORS.has(error);
}

export const TELEPHONY_TTS_DRAIN_TIMEOUT_MS = 30_000;
export const ELEVENLABS_KEEPALIVE_MS = 10_000;
export const TELEPHONY_IDLE_REPROMPT_MS = 15_000;

export const TELEPHONY_TURN_DETECTION: TelephonyTurnDetection = buildTurnDetection({
  botId: "",
  tenantId: "",
});

export const TELEPHONY_BARGE_IN_ECHO_GUARD_MS = 900;

export function shouldAcceptUserTranscript(params: {
  transcript: string;
  speaking: boolean;
  speakingStartedAt: number;
  now?: number;
}): boolean {
  if (!params.transcript.trim()) return false;
  if (!params.speaking) return true;
  const now = params.now ?? Date.now();
  return now - params.speakingStartedAt >= TELEPHONY_BARGE_IN_ECHO_GUARD_MS;
}

export function shouldSkipIdleReprompt(text: string): boolean {
  return text.includes("?");
}

export function estimateSpeechDrainMs(charCount: number): number {
  const msPerChar = 55;
  return Math.min(Math.max(charCount * msPerChar, 1_000), TELEPHONY_TTS_DRAIN_TIMEOUT_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runTelephonyBridge(
  telnyxWs: WebSocket,
  session: TelephonySession,
  initialMessages: string[] = []
): Promise<void> {
  const pendingTelnyxEvents: TelnyxInboundEvent[] = [];
  let handleTelnyxEvent: ((data: TelnyxInboundEvent) => void) | null = null;

  const receiveTelnyxMessage = (raw: RawData | string) => {
    try {
      const data = JSON.parse(String(raw)) as TelnyxInboundEvent;
      if (handleTelnyxEvent) {
        handleTelnyxEvent(data);
      } else {
        pendingTelnyxEvents.push(data);
      }
    } catch {
      return;
    }
  };

  for (const raw of initialMessages) {
    receiveTelnyxMessage(raw);
  }
  telnyxWs.on("message", receiveTelnyxMessage);

  const bot = await getBot(session.tenantId, session.botId);
  if (!bot) {
    telnyxWs.close();
    return;
  }

  const [openaiKey, elevenKey, voiceRuntime, calendarEnabled] = await Promise.all([
    getOpenAIApiKey(session.tenantId),
    getElevenLabsApiKey(session.tenantId),
    fetchVoiceRuntime({
      tenantId: session.tenantId,
      botId: session.botId,
      locale: session.locale,
    }),
    isCalendarEnabled(session.tenantId, session.botId),
  ]);
  const voiceId = resolveVoiceId(bot);
  const ttsModel = resolveTtsModel(bot);
  const voiceSettings = resolveVoiceSettings(bot);
  const turnDetection = buildTurnDetection(bot);
  const bargeInEnabled = isBargeInEnabled(bot);
  const model = resolveModel(bot);
  const transcriptionModel = resolveTranscriptionModel(bot);
  const greeting = resolveGreeting(bot, session.locale);
  const instructions = voiceRuntime
    ? `${voiceRuntime.instructions}\n\n${
        session.locale === "en"
          ? `The caller has already heard this opening greeting: "${greeting}". Never repeat or restart the opening greeting. Respond directly to what the caller says next.`
          : `La persona ya escuchó este saludo inicial: "${greeting}". Nunca repitas ni reinicies el saludo inicial. Responde directamente a lo próximo que diga la persona.`
      }`
    : resolveInstructions(bot, session.locale, greeting);
  const tools =
    voiceRuntime?.tools ??
    buildRealtimeTools({
      locale: session.locale,
      knowledgeEnabled: Boolean(bot.knowledgeEnabled),
      calendarEnabled,
      handoffEnabled: Boolean(bot.telephonyHandoffEnabled),
    });

  let elevenWs: WebSocket | null = null;
  let elevenUnavailable = false;
  let elevenConnecting: Promise<WebSocket | null> | null = null;
  let openaiWs: WebSocket | null = null;
  let openaiSocket: WebSocket | null = null;
  let speaking = false;
  let speakingStartedAt = 0;
  let closed = false;
  let draining = false;
  let drainPromise: Promise<void> | null = null;
  let openaiHandlerCount = 0;
  let ttsQueue: Promise<boolean> = Promise.resolve(true);
  let streamReady = false;
  let telnyxStreamId: string | undefined;
  let mediaTrackLogged = false;
  let greetingSent = false;
  let speechEpoch = 0;
  let idleRepromptTimer: NodeJS.Timeout | null = null;
  const spokenResponseIds = new Set<string>();
  const interruptedElevenSockets = new Set<WebSocket>();
  const pendingTelnyxAudio: string[] = [];
  let openaiInputTokens = 0;
  let openaiOutputTokens = 0;
  let elevenlabsCharacters = 0;
  let usageReported = false;
  let activeSpeechComplete: (() => void) | null = null;
  let backgroundEngine: BackgroundSoundEngine | null = null;

  const backgroundSoundId = resolveBackgroundSoundId(bot.telephonyBackgroundSound);
  if (backgroundSoundId) {
    const loop = await fetchBackgroundSoundLoop(backgroundSoundId, elevenKey);
    if (loop) {
      backgroundEngine = new BackgroundSoundEngine(
        loop,
        resolveBackgroundSoundVolume(bot.telephonyBackgroundSoundVolume)
      );
      console.log(`Background sound ${backgroundSoundId} enabled for call ${session.callId}`);
    }
  }

  const completeActiveSpeech = () => {
    speaking = false;
    speakingStartedAt = 0;
    backgroundEngine?.setTtsActive(false);
    if (!activeSpeechComplete) return;
    const resolve = activeSpeechComplete;
    activeSpeechComplete = null;
    resolve();
  };

  const clearIdleReprompt = () => {
    if (!idleRepromptTimer) return;
    clearTimeout(idleRepromptTimer);
    idleRepromptTimer = null;
  };

  const interruptSpeech = () => {
    const wasSpeaking = speaking;
    speechEpoch += 1;
    clearIdleReprompt();
    pendingTelnyxAudio.length = 0;
    sendJson(telnyxWs, {
      event: "clear",
      ...(telnyxStreamId ? { stream_id: telnyxStreamId } : {}),
    });
    if (!wasSpeaking) return;
    backgroundEngine?.setTtsActive(false);
    const socket = elevenWs;
    if (socket?.readyState === WebSocket.OPEN) {
      interruptedElevenSockets.add(socket);
      elevenWs = null;
      socket.close();
    }
    completeActiveSpeech();
  };

  const reportUsageOnce = () => {
    if (usageReported) return;
    usageReported = true;
    void reportCallUsage({
      tenantId: session.tenantId,
      botId: session.botId,
      callId: session.callId,
      usage: {
        openaiInputTokens,
        openaiOutputTokens,
        elevenlabsCharacters,
        elevenlabsModelId: ttsModel,
      },
    });
  };

  const sendTelnyxMediaRaw = (payload: string) => {
    if (!streamReady) {
      pendingTelnyxAudio.push(payload);
      return;
    }
    sendJson(telnyxWs, {
      event: "media",
      media: { payload },
    });
  };

  const sendTelnyxMedia = (payload: string) => {
    const output = backgroundEngine ? backgroundEngine.mixTtsPayload(payload) : payload;
    sendTelnyxMediaRaw(output);
  };

  const flushPendingTelnyxAudio = () => {
    for (const payload of pendingTelnyxAudio) {
      sendTelnyxMedia(payload);
    }
    pendingTelnyxAudio.length = 0;
  };

  const maybeStartGreeting = () => {
    if (greetingSent || !streamReady) return;
    greetingSent = true;
    console.log(`Telephony greeting for call ${session.callId}`);
    void (async () => {
      const spoke = await speakText(greeting);
      if (spoke) {
        await persistTranscript("assistant", greeting, `greeting-${session.callId}`);
        scheduleIdleReprompt(greeting);
      }
    })();
  };

  const persistTranscript = async (role: "user" | "assistant", content: string, externalId?: string) => {
    await persistPhoneMessage({
      tenantId: session.tenantId,
      botId: session.botId,
      conversationId: session.conversationId,
      callId: session.callId,
      role,
      content,
      externalId,
    }).catch((error) => {
      console.error("Failed to persist phone transcript:", error);
    });
  };

  const resolveSpeechComplete = () => {
    completeActiveSpeech();
  };

  const waitForSpeechPlayback = (charCount: number): Promise<void> =>
    sleep(estimateSpeechDrainMs(charCount));

  const closeAll = () => {
    if (closed) return;
    closed = true;
    draining = true;
    clearIdleReprompt();
    reportUsageOnce();
    backgroundEngine?.stop();
    if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
    if (elevenWs?.readyState === WebSocket.OPEN) elevenWs.close();
    if (telnyxWs.readyState === WebSocket.OPEN) telnyxWs.close();
  };

  const beginDrain = () => {
    if (closed || drainPromise) return;
    draining = true;
    drainPromise = (async () => {
      console.log(`Draining TTS for call ${session.callId}`);
      const deadline = Date.now() + TELEPHONY_TTS_DRAIN_TIMEOUT_MS;
      while (openaiHandlerCount > 0 && Date.now() < deadline) {
        await sleep(50);
      }
      await ttsQueue.catch(() => false);
      while (speaking && Date.now() < deadline) {
        await sleep(100);
      }
      closeAll();
    })().catch((error) => {
      console.error(`Drain failed for call ${session.callId}:`, error);
      closeAll();
    });
  };

  const flushElevenLabs = () => {
    if (!elevenWs || elevenWs.readyState !== WebSocket.OPEN) return;
    elevenWs.send(
      JSON.stringify({
        text: " ",
        flush: true,
      })
    );
  };

  const speakTextOnce = async (text: string, epoch: number): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed || closed || epoch !== speechEpoch) return false;
    const socket = await ensureElevenLabs();
    if (!socket || epoch !== speechEpoch) return false;

    speaking = true;
    speakingStartedAt = Date.now();
    backgroundEngine?.setTtsActive(true);
    elevenlabsCharacters += trimmed.length;
    const playbackDone = new Promise<void>((resolve) => {
      activeSpeechComplete = resolve;
    });
    socket.send(
      JSON.stringify({
        text: `${trimmed} `,
        try_trigger_generation: true,
      })
    );
    flushElevenLabs();
    await Promise.race([playbackDone, waitForSpeechPlayback(trimmed.length)]);
    if (epoch !== speechEpoch) return false;
    completeActiveSpeech();
    return true;
  };

  const speakText = (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed || closed) return Promise.resolve(false);
    const epoch = speechEpoch;
    const next = ttsQueue.then(
      () => speakTextOnce(trimmed, epoch),
      () => speakTextOnce(trimmed, epoch)
    );
    ttsQueue = next.then(
      () => true,
      () => false
    );
    return next;
  };

  const scheduleIdleReprompt = (lastAssistantText?: string) => {
    clearIdleReprompt();
    if (closed || draining) return;
    if (lastAssistantText && shouldSkipIdleReprompt(lastAssistantText)) return;
    idleRepromptTimer = setTimeout(() => {
      idleRepromptTimer = null;
      if (closed || draining || speaking) return;
      const text =
        session.locale === "en"
          ? "Are you still there? Tell me how I can help."
          : "¿Sigues ahí? Dime cómo puedo ayudarte.";
      void (async () => {
        const epoch = speechEpoch;
        const spoke = await speakText(text);
        if (spoke && epoch === speechEpoch) {
          await persistTranscript("assistant", text, `idle-${randomUUID()}`);
        }
      })();
    }, TELEPHONY_IDLE_REPROMPT_MS);
  };

  const flushAssistantResponse = async (text: string, eventId?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    clearIdleReprompt();
    const epoch = speechEpoch;
    const spoke = await speakText(trimmed);
    if (spoke) {
      await persistTranscript("assistant", trimmed, eventId ?? randomUUID());
      scheduleIdleReprompt(trimmed);
      return;
    }
    if (epoch !== speechEpoch) {
      console.log(`Assistant speech interrupted for call ${session.callId}`);
      return;
    }
    if (!draining && !closed) {
      await persistTranscript("assistant", trimmed, eventId ?? randomUUID());
      return;
    }
    console.warn(
      `Skipped transcript for unspoken assistant message on call ${session.callId}`
    );
  };

  const markStreamReady = () => {
    if (streamReady) return;
    streamReady = true;
    console.log(`Telnyx stream ready for call ${session.callId}`);
    flushPendingTelnyxAudio();
    if (backgroundEngine) {
      backgroundEngine.startIdlePump(sendTelnyxMediaRaw);
    }
    maybeStartGreeting();
  };

  handleTelnyxEvent = (data: TelnyxInboundEvent) => {
    if (data.event === "start" || data.event === "connected") {
      telnyxStreamId = data.stream_id ?? data.start?.stream_id ?? telnyxStreamId;
      markStreamReady();
      return;
    }

    if (data.event === "media" && data.media?.payload) {
      if (!mediaTrackLogged) {
        mediaTrackLogged = true;
        console.log(
          `Telnyx media track for call ${session.callId}: ${data.media.track ?? "legacy"}`
        );
      }
      if (!isInboundTelnyxMedia(data.media.track)) return;
      if (!streamReady) {
        markStreamReady();
      }
      if (!openaiSocket || openaiSocket.readyState !== WebSocket.OPEN || draining) {
        return;
      }
      sendJson(openaiSocket, {
        type: "input_audio_buffer.append",
        audio: data.media.payload,
      });
      return;
    }

    if (data.event === "stop") {
      beginDrain();
    }
  };

  for (const event of pendingTelnyxEvents) {
    handleTelnyxEvent(event);
  }
  pendingTelnyxEvents.length = 0;

  telnyxWs.on("close", beginDrain);
  telnyxWs.on("error", beginDrain);

  const openElevenLabs = () =>
    new Promise<WebSocket | null>((resolve) => {
      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=${encodeURIComponent(ttsModel)}&output_format=ulaw_8000`;
      const socket = new WebSocket(url, {
        headers: { "xi-api-key": elevenKey },
      });
      let settled = false;
      let keepalive: NodeJS.Timeout | null = null;
      const stopKeepalive = () => {
        if (!keepalive) return;
        clearInterval(keepalive);
        keepalive = null;
      };
      const settle = (result: WebSocket | null) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      socket.on("open", () => {
        console.log(`ElevenLabs connected for call ${session.callId}`);
        elevenWs = socket;
        socket.send(
          JSON.stringify({
            text: " ",
            voice_settings: voiceSettings,
            generation_config: { chunk_length_schedule: [80, 120, 160, 250] },
          })
        );
        keepalive = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ text: " " }));
          }
        }, ELEVENLABS_KEEPALIVE_MS);
        settle(socket);
      });

      socket.on("message", (raw) => {
        let data: { audio?: string; isFinal?: boolean; error?: string; message?: string };
        try {
          data = JSON.parse(String(raw)) as {
            audio?: string;
            isFinal?: boolean;
            error?: string;
            message?: string;
          };
        } catch {
          return;
        }
        if (data.error) {
          console.error(
            `ElevenLabs error for call ${session.callId}: ${data.error} - ${data.message ?? ""}`
          );
          if (isFatalElevenLabsError(data.error)) elevenUnavailable = true;
          return;
        }
        if (socket !== elevenWs) return;
        if (data.audio) {
          sendTelnyxMedia(data.audio);
        }
        if (data.isFinal) {
          completeActiveSpeech();
        }
      });

      socket.on("close", (code, reason) => {
        stopKeepalive();
        const interrupted = interruptedElevenSockets.delete(socket);
        if (elevenWs === socket) elevenWs = null;
        resolveSpeechComplete();
        if (!closed && !interrupted) {
          console.error(
            `ElevenLabs socket closed for call ${session.callId} code=${code} reason=${String(reason)}`
          );
        }
        settle(null);
      });

      socket.on("error", (error) => {
        stopKeepalive();
        console.error(`ElevenLabs socket error for call ${session.callId}:`, error);
        settle(null);
      });
    });

  const ensureElevenLabs = async (): Promise<WebSocket | null> => {
    if (closed || elevenUnavailable) return null;
    if (elevenWs?.readyState === WebSocket.OPEN) return elevenWs;
    if (!elevenConnecting) {
      elevenConnecting = openElevenLabs().finally(() => {
        elevenConnecting = null;
      });
    }
    return elevenConnecting;
  };

  const connectOpenAI = () =>
    new Promise<WebSocket>((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      const socket = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      });
      openaiWs = socket;
      openaiSocket = socket;
      const toolResponseCoordinator = new ToolResponseCoordinator(() => {
        sendJson(socket, { type: "response.create" });
      });

      socket.on("open", () => {
        sendJson(
          socket,
          buildOpenAISessionUpdate({
            model,
            transcriptionModel,
            instructions,
            tools,
            locale: session.locale,
            turnDetection,
          })
        );
        resolve(socket);
      });

      socket.on("message", (raw) => {
        void (async () => {
          openaiHandlerCount += 1;
          try {
          let data: OpenAIEvent;
          try {
            data = JSON.parse(String(raw)) as OpenAIEvent;
          } catch {
            return;
          }

          if (data.type === "session.updated") {
            console.log(`OpenAI session ready for call ${session.callId}`);
            return;
          }

          if (data.type === "error") {
            console.error("OpenAI realtime error:", data);
            return;
          }

          if (data.type === "response.created") {
            toolResponseCoordinator.responseStarted();
            return;
          }

          if (data.type === "input_audio_buffer.speech_started") {
            if (bargeInEnabled && speaking) interruptSpeech();
            console.log(
              `OpenAI speech started for call ${session.callId} item=${data.item_id ?? "unknown"}`
            );
            return;
          }

          if (data.type === "input_audio_buffer.speech_stopped") {
            console.log(
              `OpenAI speech stopped for call ${session.callId} item=${data.item_id ?? "unknown"}`
            );
            return;
          }

          if (data.type === "conversation.item.input_audio_transcription.failed") {
            clearIdleReprompt();
            console.error(
              `OpenAI transcription failed for call ${session.callId}: ${data.error?.message ?? data.error?.code ?? "unknown error"}`
            );
            if (!speaking) scheduleIdleReprompt();
            return;
          }

          if (data.type === "conversation.item.input_audio_transcription.completed") {
            const transcript = data.transcript?.trim() ?? "";
            if (
              !shouldAcceptUserTranscript({
                transcript,
                speaking,
                speakingStartedAt,
              })
            ) {
              if (!transcript) {
                console.warn(
                  `OpenAI transcription was empty for call ${session.callId} item=${data.item_id ?? "unknown"}`
                );
                if (!speaking) scheduleIdleReprompt();
              } else {
                console.warn(
                  `Ignoring echo transcription for call ${session.callId} item=${data.item_id ?? "unknown"}`
                );
                if (openaiWs?.readyState === WebSocket.OPEN) {
                  sendJson(openaiWs, { type: "response.cancel" });
                }
              }
              return;
            }
            clearIdleReprompt();
            if (speaking) interruptSpeech();
            console.log(
              `OpenAI transcription completed for call ${session.callId} item=${data.item_id ?? "unknown"}`
            );
            openaiInputTokens += Math.ceil(transcript.length / 4);
            await persistTranscript("user", transcript, data.event_id ?? randomUUID());
            return;
          }

          if (data.type === "response.done" && data.response) {
            toolResponseCoordinator.responseFinished();
            const usage = data.response.usage;
            if (usage) {
              openaiInputTokens += usage.input_tokens ?? 0;
              openaiOutputTokens += usage.output_tokens ?? 0;
            }

            const responseId = data.response.id ?? data.event_id;
            if (responseId) {
              if (spokenResponseIds.has(responseId)) return;
              spokenResponseIds.add(responseId);
            }

            const text = extractResponseText(data.response);
            if (text) {
              await flushAssistantResponse(text, data.event_id);
            }
            return;
          }

          if (data.type === "response.function_call_arguments.done" && data.name && data.call_id) {
            toolResponseCoordinator.toolStarted();
            const toolStartedAt = Date.now();
            try {
              let result: Awaited<ReturnType<typeof executeTelephonyTool>>;
              try {
                result = await executeTelephonyTool({
                  tenantId: session.tenantId,
                  botId: session.botId,
                  conversationId: session.conversationId,
                  participantId: session.participantId,
                  locale: session.locale,
                  name: data.name,
                  arguments: data.arguments ?? "{}",
                  callId: session.callId,
                });
              } catch (error) {
                console.error(`Tool execution failed for ${data.name}:`, error);
                result = {
                  output: JSON.stringify({ error: "Tool execution failed" }),
                };
              }

              const toolLatencyMs = Date.now() - toolStartedAt;
              const toolOutcome = parseToolExecutionResult(result.output);
              void reportToolExecution({
                tenantId: session.tenantId,
                botId: session.botId,
                callId: session.callId,
                toolName: data.name,
                latencyMs: toolLatencyMs,
                success: toolOutcome.success,
                ...(toolOutcome.statusCode !== undefined
                  ? { statusCode: toolOutcome.statusCode }
                  : {}),
                ...(toolOutcome.error ? { error: toolOutcome.error } : {}),
              });

              sendJson(socket, {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: data.call_id,
                  output: result.output,
                },
              });

              if (result.handoff) {
                beginDrain();
              }
            } finally {
              toolResponseCoordinator.toolFinished();
            }
            return;
          }
          } finally {
            openaiHandlerCount -= 1;
          }
        })().catch((error) => {
          console.error("OpenAI bridge handler error:", error);
        });
      });

      socket.on("close", (code, reason) => {
        console.error(
          `OpenAI socket closed for call ${session.callId} code=${code} reason=${String(reason)}`
        );
      });

      socket.on("error", (error) => {
        console.error(`OpenAI socket error for call ${session.callId}:`, error);
        reject(error);
      });
    });

  const [, connectedOpenai] = await Promise.all([ensureElevenLabs(), connectOpenAI()]);
  openaiSocket = connectedOpenai;

  openaiSocket.on("close", beginDrain);

  setTimeout(beginDrain, 14 * 60 * 1000);
}
