import { randomUUID } from "crypto";
import WebSocket from "ws";
import type { SttAdapter, SttAdapterConnectParams, SttLiveSession } from "./types.js";

const KEEPALIVE_MS = 5_000;
const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";

type DeepgramResultMessage = {
  type?: string;
  channel?: { alternatives?: Array<{ transcript?: string }> };
  is_final?: boolean;
  speech_final?: boolean;
};

function buildDeepgramUrl(model: string, locale: "es" | "en", silenceMs: number): string {
  const language = locale === "en" ? "en" : "es";
  const endpointing = String(Math.max(100, Math.min(silenceMs, 1200)));
  const utteranceEndMs = String(Math.max(1000, Number(endpointing)));
  const params = new URLSearchParams({
    model,
    encoding: "mulaw",
    sample_rate: "8000",
    channels: "1",
    language,
    smart_format: "true",
    interim_results: "true",
    endpointing,
    utterance_end_ms: utteranceEndMs,
    vad_events: "true",
  });
  return `${DEEPGRAM_WS_URL}?${params.toString()}`;
}

function extractTranscript(message: DeepgramResultMessage): string {
  return message.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
}

export function mulawBase64ToSeconds(base64Payload: string): number {
  const byteLength = Buffer.from(base64Payload, "base64").length;
  return byteLength / 8000;
}

export const deepgramSttAdapter: SttAdapter = {
  provider: "deepgram",
  connect(params: SttAdapterConnectParams): Promise<SttLiveSession> {
    return new Promise((resolve, reject) => {
      const url = buildDeepgramUrl(params.model, params.locale, params.silenceMs);
      const socket = new WebSocket(url, {
        headers: { Authorization: `Token ${params.apiKey}` },
      });

      let closed = false;
      let settled = false;
      let keepalive: NodeJS.Timeout | null = null;
      let pendingSegments: string[] = [];
      let audioSeconds = 0;

      const stopKeepalive = () => {
        if (!keepalive) return;
        clearInterval(keepalive);
        keepalive = null;
      };

      const closeSocket = () => {
        if (closed) return;
        closed = true;
        stopKeepalive();
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "CloseStream" }));
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.terminate();
        }
      };

      const flushUtterance = () => {
        const transcript = pendingSegments.join(" ").trim();
        pendingSegments = [];
        if (!transcript) return;
        params.callbacks.onFinalTranscript(transcript, randomUUID());
      };

      const session: SttLiveSession = {
        sendAudio(base64Mulaw: string) {
          if (closed || socket.readyState !== WebSocket.OPEN) return;
          const payload = Buffer.from(base64Mulaw, "base64");
          if (payload.length === 0) return;
          audioSeconds += payload.length / 8000;
          socket.send(payload);
        },
        close() {
          flushUtterance();
          closeSocket();
        },
        getAudioSeconds() {
          return audioSeconds;
        },
      };

      socket.on("open", () => {
        keepalive = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, KEEPALIVE_MS);
        if (!settled) {
          settled = true;
          resolve(session);
        }
      });

      socket.on("message", (raw) => {
        let message: DeepgramResultMessage;
        try {
          message = JSON.parse(String(raw)) as DeepgramResultMessage;
        } catch {
          return;
        }

        if (message.type === "UtteranceEnd") {
          flushUtterance();
          return;
        }

        if (message.type !== "Results") return;

        const transcript = extractTranscript(message);
        if (!transcript) return;

        if (message.is_final) {
          pendingSegments.push(transcript);
        }

        if (message.speech_final) {
          flushUtterance();
        }
      });

      socket.on("error", (error) => {
        params.callbacks.onError?.(error instanceof Error ? error.message : String(error));
        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      socket.on("close", () => {
        stopKeepalive();
        flushUtterance();
        if (!settled) {
          settled = true;
          reject(new Error("Deepgram connection closed before ready"));
        }
      });
    });
  },
};
