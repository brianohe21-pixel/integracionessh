import { randomUUID } from "crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import WebSocket, { type RawData } from "ws";
import { isCalendarEnabled } from "./calendar.js";
import { docClient, tableName } from "./dynamo.js";
import { persistPhoneMessage } from "./messages.js";
import { getElevenLabsApiKey, getOpenAIApiKey } from "./secrets.js";
import { buildRealtimeTools, executeTelephonyTool, reportCallUsage } from "./tools.js";
import type { Bot, TelephonySession } from "./types.js";

type OpenAIEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  event_id?: string;
  response?: {
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

function resolveInstructions(bot: Bot, locale: TelephonySession["locale"]): string {
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
  return `${base}\n\n${language}${handoffInstruction}`;
}

function resolveGreeting(bot: Bot, locale: TelephonySession["locale"]): string {
  const greeting = bot.telephonyGreeting?.trim() || bot.voicebotGreeting?.trim();
  const text =
    greeting ||
    (locale === "en"
      ? "Hello! How can I help you today?"
      : "Hola, ¿en qué puedo ayudarte?");
  if (bot.telephonyRecordingEnabled) {
    const notice =
      bot.telephonyRecordingNotice?.trim() ||
      "This call may be recorded for quality and training purposes.";
    return `${notice} ${text}`;
  }
  return text;
}

export function isInboundTelnyxMedia(track?: string): boolean {
  if (!track) return true;
  return track === "inbound";
}

export function buildOpenAISessionUpdate(params: {
  model: string;
  instructions: string;
  tools: Array<Record<string, unknown>>;
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
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true,
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
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

  const openaiKey = await getOpenAIApiKey(session.tenantId);
  const elevenKey = await getElevenLabsApiKey(session.tenantId);
  const voiceId = resolveVoiceId(bot);
  const model = resolveModel(bot);
  const instructions = resolveInstructions(bot, session.locale);
  const greeting = resolveGreeting(bot, session.locale);
  const calendarEnabled = await isCalendarEnabled(session.tenantId, session.botId);
  const tools = buildRealtimeTools({
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
  let responseTextBuffer = "";
  let speaking = false;
  let closed = false;
  let streamReady = false;
  let openaiReady = false;
  let greetingSent = false;
  let spokeFromStream = false;
  const pendingTelnyxAudio: string[] = [];
  let openaiInputTokens = 0;
  let openaiOutputTokens = 0;
  let elevenlabsCharacters = 0;
  let usageReported = false;

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
      },
    });
  };

  const sendTelnyxMedia = (payload: string) => {
    if (!streamReady) {
      pendingTelnyxAudio.push(payload);
      return;
    }
    sendJson(telnyxWs, {
      event: "media",
      media: { payload },
    });
  };

  const flushPendingTelnyxAudio = () => {
    for (const payload of pendingTelnyxAudio) {
      sendJson(telnyxWs, {
        event: "media",
        media: { payload },
      });
    }
    pendingTelnyxAudio.length = 0;
  };

  const maybeStartGreeting = () => {
    if (greetingSent || !openaiWs || openaiWs.readyState !== WebSocket.OPEN || !streamReady || !openaiReady) {
      return;
    }
    greetingSent = true;
    console.log(`Telephony greeting requested for call ${session.callId}`);
    sendJson(openaiWs, {
      type: "response.create",
      response: {
        output_modalities: ["text"],
        instructions: greeting,
      },
    });
  };

  const persistTranscript = async (role: "user" | "assistant", content: string, externalId?: string) => {
    await persistPhoneMessage({
      tenantId: session.tenantId,
      botId: session.botId,
      conversationId: session.conversationId,
      role,
      content,
      externalId,
    }).catch((error) => {
      console.error("Failed to persist phone transcript:", error);
    });
  };

  const closeAll = () => {
    if (closed) return;
    closed = true;
    reportUsageOnce();
    if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
    if (elevenWs?.readyState === WebSocket.OPEN) elevenWs.close();
    if (telnyxWs.readyState === WebSocket.OPEN) telnyxWs.close();
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

  const speakText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const socket = await ensureElevenLabs();
    if (!socket) return;
    speaking = true;
    elevenlabsCharacters += trimmed.length;
    socket.send(
      JSON.stringify({
        text: `${trimmed} `,
        try_trigger_generation: true,
      })
    );
    flushElevenLabs();
  };

  const flushAssistantResponse = async (text: string, eventId?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    spokeFromStream = true;
    await persistTranscript("assistant", trimmed, eventId ?? randomUUID());
    await speakText(trimmed);
  };

  const markStreamReady = () => {
    if (streamReady) return;
    streamReady = true;
    console.log(`Telnyx stream ready for call ${session.callId}`);
    flushPendingTelnyxAudio();
    maybeStartGreeting();
  };

  handleTelnyxEvent = (data: TelnyxInboundEvent) => {
    if (data.event === "start" || data.event === "connected") {
      markStreamReady();
      return;
    }

    if (
      data.event === "media" &&
      data.media?.payload &&
      isInboundTelnyxMedia(data.media.track)
    ) {
      if (!streamReady) {
        markStreamReady();
      }
      if (!openaiSocket || openaiSocket.readyState !== WebSocket.OPEN) return;
      sendJson(openaiSocket, {
        type: "input_audio_buffer.append",
        audio: data.media.payload,
      });
      return;
    }

    if (data.event === "stop") {
      closeAll();
    }
  };

  for (const event of pendingTelnyxEvents) {
    handleTelnyxEvent(event);
  }
  pendingTelnyxEvents.length = 0;

  telnyxWs.on("close", closeAll);
  telnyxWs.on("error", closeAll);

  const openElevenLabs = () =>
    new Promise<WebSocket | null>((resolve) => {
      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=eleven_flash_v2_5&output_format=ulaw_8000`;
      const socket = new WebSocket(url, {
        headers: { "xi-api-key": elevenKey },
      });
      let settled = false;
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
            voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
            generation_config: { chunk_length_schedule: [80, 120, 160, 250] },
          })
        );
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
        if (data.audio) {
          sendTelnyxMedia(data.audio);
        }
        if (data.isFinal) speaking = false;
      });

      socket.on("close", (code, reason) => {
        if (elevenWs === socket) elevenWs = null;
        speaking = false;
        if (code === 1008) elevenUnavailable = true;
        if (!closed) {
          console.error(
            `ElevenLabs socket closed for call ${session.callId} code=${code} reason=${String(reason)}`
          );
        }
        settle(null);
      });

      socket.on("error", (error) => {
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

      socket.on("open", () => {
        sendJson(
          socket,
          buildOpenAISessionUpdate({
            model,
            instructions,
            tools,
          })
        );
        resolve(socket);
      });

      socket.on("message", (raw) => {
        void (async () => {
          let data: OpenAIEvent;
          try {
            data = JSON.parse(String(raw)) as OpenAIEvent;
          } catch {
            return;
          }

          if (data.type === "session.updated") {
            openaiReady = true;
            console.log(`OpenAI session ready for call ${session.callId}`);
            maybeStartGreeting();
            return;
          }

          if (data.type === "error") {
            console.error("OpenAI realtime error:", data);
            return;
          }

          if (
            data.type === "conversation.item.input_audio_transcription.completed" &&
            data.transcript
          ) {
            openaiInputTokens += Math.ceil(data.transcript.length / 4);
            await persistTranscript("user", data.transcript, data.event_id ?? randomUUID());
            return;
          }

          if (data.type === "response.created") {
            spokeFromStream = false;
            responseTextBuffer = "";
            return;
          }

          if (data.type === "response.done" && data.response) {
            const usage = data.response.usage as {
              input_tokens?: number;
              output_tokens?: number;
            } | undefined;
            if (usage) {
              openaiInputTokens += usage.input_tokens ?? 0;
              openaiOutputTokens += usage.output_tokens ?? 0;
            }

            const fallbackText = extractResponseText(data.response);
            if (fallbackText && !spokeFromStream) {
              await flushAssistantResponse(fallbackText, data.event_id);
            }
            spokeFromStream = false;
            return;
          }

          if (data.type === "response.text.delta" && data.delta) {
            responseTextBuffer += data.delta;
            return;
          }

          if (data.type === "response.text.done") {
            const text = responseTextBuffer.trim();
            responseTextBuffer = "";
            if (text) {
              await flushAssistantResponse(text, data.event_id);
            }
            return;
          }

          if (data.type === "response.output_text.delta" && data.delta) {
            responseTextBuffer += data.delta;
            return;
          }

          if (data.type === "response.output_text.done") {
            const text = responseTextBuffer.trim();
            responseTextBuffer = "";
            if (text) {
              await flushAssistantResponse(text, data.event_id);
            }
            return;
          }

          if (data.type === "response.function_call_arguments.done" && data.name && data.call_id) {
            const result = await executeTelephonyTool({
              tenantId: session.tenantId,
              botId: session.botId,
              conversationId: session.conversationId,
              participantId: session.participantId,
              locale: session.locale,
              name: data.name,
              arguments: data.arguments ?? "{}",
            });

            sendJson(socket, {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: data.call_id,
                output: result.output,
              },
            });
            sendJson(socket, { type: "response.create" });

            if (result.handoff) {
              closeAll();
            }
            return;
          }

          if (data.type === "input_audio_buffer.speech_started" && speaking) {
            sendJson(telnyxWs, { event: "clear" });
            speaking = false;
            sendJson(socket, { type: "response.cancel" });
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

  openaiSocket.on("close", closeAll);

  setTimeout(closeAll, 14 * 60 * 1000);
}
