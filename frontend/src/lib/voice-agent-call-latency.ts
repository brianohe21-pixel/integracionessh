import type { CallEvent, Message } from "@/types";

export type CallTurnLatency = {
  userAt: string;
  assistantAt: string;
  latencyMs: number;
};

export type CallLatencySummary = {
  ringMs: number | null;
  answerMs: number | null;
  talkMs: number | null;
  turns: CallTurnLatency[];
  avgResponseMs: number | null;
  minResponseMs: number | null;
  maxResponseMs: number | null;
};

function eventTimestamp(events: CallEvent[], type: CallEvent["type"]): number | null {
  const event = events.find((item) => item.type === type);
  if (!event) return null;
  const value = new Date(event.createdAt).getTime();
  return Number.isFinite(value) ? value : null;
}

function diffMs(start: number | null, end: number | null): number | null {
  if (start === null || end === null || end < start) return null;
  return end - start;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildTurnLatencies(messages: Message[]): CallTurnLatency[] {
  const turns: CallTurnLatency[] = [];
  let pendingUserAt: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      pendingUserAt = message.timestamp;
      continue;
    }

    if (message.role !== "assistant" || !pendingUserAt) continue;

    const userMs = new Date(pendingUserAt).getTime();
    const assistantMs = new Date(message.timestamp).getTime();
    if (!Number.isFinite(userMs) || !Number.isFinite(assistantMs) || assistantMs < userMs) {
      pendingUserAt = null;
      continue;
    }

    turns.push({
      userAt: pendingUserAt,
      assistantAt: message.timestamp,
      latencyMs: assistantMs - userMs,
    });
    pendingUserAt = null;
  }

  return turns;
}

export function buildCallLatencySummary(params: {
  events: CallEvent[];
  messages: Message[];
  durationSeconds?: number;
}): CallLatencySummary {
  const initiatedAt = eventTimestamp(params.events, "initiated");
  const ringingAt = eventTimestamp(params.events, "ringing");
  const answeredAt = eventTimestamp(params.events, "answered");
  const hangupAt = eventTimestamp(params.events, "hangup");

  const turns = buildTurnLatencies(params.messages);
  const responseLatencies = turns.map((turn) => turn.latencyMs);

  const talkMs =
    params.durationSeconds !== undefined
      ? params.durationSeconds * 1000
      : diffMs(answeredAt, hangupAt);

  return {
    ringMs: diffMs(initiatedAt, ringingAt),
    answerMs: diffMs(initiatedAt, answeredAt),
    talkMs,
    turns,
    avgResponseMs: average(responseLatencies),
    minResponseMs: responseLatencies.length > 0 ? Math.min(...responseLatencies) : null,
    maxResponseMs: responseLatencies.length > 0 ? Math.max(...responseLatencies) : null,
  };
}

export function formatLatencyMs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export const TURN_LATENCY_CHART_CAP_MS = 10_000;

export function formatLatencyAxisTick(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 10000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value / 1000)}s`;
}

export function turnLatencyChartDisplayValue(latencyMs: number): number {
  if (!Number.isFinite(latencyMs) || latencyMs <= 0) return 0;
  return Math.min(latencyMs, TURN_LATENCY_CHART_CAP_MS);
}

export function isTurnLatencyChartCapped(latencyMs: number): boolean {
  return Number.isFinite(latencyMs) && latencyMs > TURN_LATENCY_CHART_CAP_MS;
}
