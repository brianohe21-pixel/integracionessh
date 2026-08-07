import { randomUUID } from "crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import WebSocket from "ws";
import { isCalendarEnabled } from "./calendar.js";
import { docClient, tableName } from "./dynamo.js";
import { persistPhoneMessage } from "./messages.js";
import { getElevenLabsApiKey, getOpenAIApiKey } from "./secrets.js";
import { buildRealtimeTools, executeTelephonyTool } from "./tools.js";
import type { Bot, TelephonySession } from "./types.js";

type OpenAIEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  event_id?: string;
};

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
  return `${base}\n\n${language}`;
}

function resolveGreeting(bot: Bot): string | undefined {
  const greeting = bot.telephonyGreeting?.trim() || bot.voicebotGreeting?.trim();
  return greeting || undefined;
}

export async function runTelephonyBridge(
  telnyxWs: WebSocket,
  session: TelephonySession
): Promise<void> {
  const bot = await getBot(session.tenantId, session.botId);
  if (!bot) {
    telnyxWs.close();
    return;
  }

  const openaiKey = await getOpenAIApiKey(session.tenantId);
  const elevenKey = await getElevenLabsApiKey();
  const voiceId = resolveVoiceId(bot);
  const model = resolveModel(bot);
  const instructions = resolveInstructions(bot, session.locale);
  const greeting = resolveGreeting(bot);
  const calendarEnabled = await isCalendarEnabled(session.tenantId, session.botId);
  const tools = buildRealtimeTools({
    locale: session.locale,
    knowledgeEnabled: Boolean(bot.knowledgeEnabled),
    calendarEnabled,
  });

  let elevenWs: WebSocket | null = null;
  let openaiWs: WebSocket | null = null;
  let responseTextBuffer = "";
  let speaking = false;
  let closed = false;

  const closeAll = () => {
    if (closed) return;
    closed = true;
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

  const speakText = (text: string) => {
    if (!elevenWs || elevenWs.readyState !== WebSocket.OPEN || !text.trim()) return;
    speaking = true;
    elevenWs.send(
      JSON.stringify({
        text: `${text.trim()} `,
        try_trigger_generation: true,
      })
    );
    flushElevenLabs();
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

  const connectElevenLabs = () =>
    new Promise<WebSocket>((resolve, reject) => {
      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=eleven_flash_v2_5&output_format=ulaw_8000`;
      const socket = new WebSocket(url, {
        headers: { "xi-api-key": elevenKey },
      });
      elevenWs = socket;

      socket.on("open", () => {
        socket.send(
          JSON.stringify({
            text: " ",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
            generation_config: { chunk_length_schedule: [80, 120, 160, 250] },
          })
        );
        resolve(socket);
      });

      socket.on("message", (raw) => {
        let data: { audio?: string; isFinal?: boolean };
        try {
          data = JSON.parse(String(raw)) as { audio?: string; isFinal?: boolean };
        } catch {
          return;
        }
        if (data.audio) {
          sendJson(telnyxWs, {
            event: "media",
            media: { payload: data.audio },
          });
        }
        if (data.isFinal) speaking = false;
      });

      socket.on("error", (error) => reject(error));
    });

  const connectOpenAI = () =>
    new Promise<WebSocket>((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      const socket = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });
      openaiWs = socket;

      socket.on("open", () => {
        sendJson(socket, {
          type: "session.update",
          session: {
            modalities: ["text"],
            instructions,
            tools,
            tool_choice: "auto",
            input_audio_format: "g711_ulaw",
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            input_audio_transcription: {
              model: "gpt-4o-mini-transcribe",
            },
          },
        });

        if (greeting) {
          sendJson(socket, {
            type: "response.create",
            response: {
              modalities: ["text"],
              instructions: greeting,
            },
          });
        }
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

          if (
            data.type === "conversation.item.input_audio_transcription.completed" &&
            data.transcript
          ) {
            await persistTranscript("user", data.transcript, data.event_id ?? randomUUID());
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
              await persistTranscript("assistant", text, data.event_id ?? randomUUID());
              speakText(text);
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
              await persistTranscript("assistant", text, data.event_id ?? randomUUID());
              speakText(text);
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

      socket.on("error", (error) => reject(error));
    });

  const [elevenSocket, openaiSocket] = await Promise.all([
    connectElevenLabs(),
    connectOpenAI(),
  ]);

  telnyxWs.on("message", (raw) => {
    let data: { event?: string; media?: { payload?: string } };
    try {
      data = JSON.parse(String(raw)) as { event?: string; media?: { payload?: string } };
    } catch {
      return;
    }

    if (data.event === "media" && data.media?.payload && openaiSocket.readyState === WebSocket.OPEN) {
      sendJson(openaiSocket, {
        type: "input_audio_buffer.append",
        audio: data.media.payload,
      });
    }

    if (data.event === "stop") {
      closeAll();
    }
  });

  telnyxWs.on("close", closeAll);
  telnyxWs.on("error", closeAll);
  openaiSocket.on("close", closeAll);
  elevenSocket.on("close", closeAll);

  setTimeout(closeAll, 14 * 60 * 1000);
}
