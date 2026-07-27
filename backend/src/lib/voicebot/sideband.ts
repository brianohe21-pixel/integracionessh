import { randomUUID } from "crypto";
import { addMessage } from "../dynamodb/conversation.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getOpenAIApiKey } from "../ai/providers/openai.js";
import { incrementVoicebotMinutes } from "../dynamodb/usage.repository.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import {
  buildMessageReceivedPayload,
  buildMessageSentPayload,
} from "../integrations/payloads.js";
import { endVoicebotSession, getVoicebotSession } from "./session.repository.js";
import { executeVoicebotTool } from "./tools.js";
import type { BotLocale } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export interface VoicebotSidebandParams {
  sessionId: string;
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  locale: BotLocale;
  ephemeralKey?: string;
  greeting?: string;
}

type RealtimeEvent = {
  type: string;
  event_id?: string;
  call_id?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  item_id?: string;
};

function wsAuthToken(ephemeralKey: string | undefined, apiKey: string): string {
  return ephemeralKey ?? apiKey;
}

async function persistTranscript(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  externalId: string;
}): Promise<void> {
  if (!params.content.trim()) return;
  const message = {
    messageId: `vb-${params.externalId}`,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role: params.role,
    content: params.content.trim(),
    channel: "voicebot" as const,
    externalMessageId: params.externalId,
    timestamp: new Date().toISOString(),
    ...(params.role === "user" ? { source: "voicebot_inbound" as const } : {}),
  };
  await addMessage(message, params.botId);
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  ws.send(JSON.stringify(payload));
}

export async function runVoicebotSideband(params: VoicebotSidebandParams): Promise<void> {
  const startedAt = Date.now();
  const apiKey = await getOpenAIApiKey(params.tenantId, ENVIRONMENT);
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) throw new Error("Bot not found");

  const token = wsAuthToken(params.ephemeralKey, apiKey);
  const url = `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(params.callId)}`;

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    let closed = false;

    const finish = async () => {
      if (closed) return;
      closed = true;
      const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000));
      const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
      const current = await getVoicebotSession(params.sessionId);
      if (current?.status === "active") {
        await endVoicebotSession(params.sessionId, durationSeconds);
        await incrementVoicebotMinutes(params.tenantId, minutes);
      }
      resolve();
    };

    ws.addEventListener("open", () => {
      if (params.greeting?.trim()) {
        sendJson(ws, {
          type: "response.create",
          response: {
            instructions: params.greeting.trim(),
          },
        });
      }
    });

    ws.addEventListener("message", (event) => {
      void (async () => {
        let data: RealtimeEvent;
        try {
          data = JSON.parse(String(event.data)) as RealtimeEvent;
        } catch {
          return;
        }

        if (
          data.type === "conversation.item.input_audio_transcription.completed" &&
          data.transcript
        ) {
          await persistTranscript({
            tenantId: params.tenantId,
            botId: params.botId,
            conversationId: params.conversationId,
            role: "user",
            content: data.transcript,
            externalId: data.event_id ?? randomUUID(),
          });
          await emitIntegrationEvent(
            params.tenantId,
            "message.received",
            buildMessageReceivedPayload({
              tenantId: params.tenantId,
              botId: params.botId,
              conversationId: params.conversationId,
              channel: "voicebot",
              from: params.participantId,
              message: data.transcript,
            })
          );
          return;
        }

        if (
          (data.type === "response.output_audio_transcript.done" ||
            data.type === "response.audio_transcript.done") &&
          data.transcript
        ) {
          await persistTranscript({
            tenantId: params.tenantId,
            botId: params.botId,
            conversationId: params.conversationId,
            role: "assistant",
            content: data.transcript,
            externalId: data.event_id ?? randomUUID(),
          });
          await emitIntegrationEvent(
            params.tenantId,
            "message.sent",
            buildMessageSentPayload({
              tenantId: params.tenantId,
              botId: params.botId,
              conversationId: params.conversationId,
              channel: "voicebot",
              to: params.participantId,
              message: data.transcript,
              role: "assistant",
            })
          );
          return;
        }

        if (data.type === "response.function_call_arguments.done" && data.name && data.call_id) {
          const result = await executeVoicebotTool(data.name, data.arguments ?? "{}", {
            tenantId: params.tenantId,
            botId: params.botId,
            conversationId: params.conversationId,
            participantId: params.participantId,
            locale: params.locale,
            knowledgeEnabled: Boolean(bot.knowledgeEnabled),
            apiKey,
          });

          sendJson(ws, {
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: data.call_id,
              output: result.output,
            },
          });
          sendJson(ws, { type: "response.create" });

          if (result.handoff) {
            ws.close();
          }
          return;
        }

        if (data.type === "error") {
          console.error("Voicebot sideband error event:", data);
        }
      })().catch((error) => {
        console.error("Voicebot sideband handler error:", error);
      });
    });

    ws.addEventListener("error", (error) => {
      console.error("Voicebot sideband websocket error:", error);
      void finish();
    });

    ws.addEventListener("close", () => {
      void finish();
    });

    setTimeout(() => {
      if (!closed) {
        ws.close();
      }
    }, 14 * 60 * 1000);
  });
}
