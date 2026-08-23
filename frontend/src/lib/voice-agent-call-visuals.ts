import type { CallCostBreakdown, CallEvent, CallRecord } from "@/types";
import type { CallLatencySummary } from "@/lib/voice-agent-call-latency";

export const COST_SLICE_COLORS = {
  telephony: "#3b82f6",
  platform: "#f59e0b",
  ai: "#8b5cf6",
  voice: "#ec4899",
  recording: "#14b8a6",
} as const;

export type CostSlice = {
  key: keyof typeof COST_SLICE_COLORS;
  label: string;
  value: number;
  color: string;
  percent: number;
};

export type LatencyQuality = "fast" | "medium" | "slow";

export function statusVariant(status: CallRecord["status"]) {
  if (status === "completed" || status === "accepted") return "success" as const;
  if (status === "failed" || status === "rejected" || status === "terminated") return "danger" as const;
  if (status === "voicemail") return "warning" as const;
  if (status === "ringing" || status === "initiated") return "warning" as const;
  return "default" as const;
}

export function costStatusVariant(status?: CallRecord["costStatus"]) {
  if (status === "final") return "success" as const;
  if (status === "partial") return "warning" as const;
  return "default" as const;
}

export function recordingStatusVariant(status?: CallRecord["recordingStatus"]) {
  if (status === "ready") return "success" as const;
  if (status === "processing" || status === "pending") return "warning" as const;
  if (status === "failed") return "danger" as const;
  return "default" as const;
}

export function eventVariant(type: CallEvent["type"]) {
  if (type === "answered" || type === "recording_saved" || type === "cost_finalized") {
    return "success" as const;
  }
  if (type === "error" || type === "recording_failed") return "danger" as const;
  if (type === "voicemail_detected") return "warning" as const;
  if (
    type === "ringing" ||
    type === "cost_pending" ||
    type === "cost_partial" ||
    type === "recording_started"
  ) {
    return "warning" as const;
  }
  if (type === "initiated" || type === "hangup" || type === "tool_executed") return "info" as const;
  return "accent" as const;
}

export function latencyQuality(ms: number): LatencyQuality {
  if (ms < 1500) return "fast";
  if (ms < 3500) return "medium";
  return "slow";
}

export function latencyVariant(ms: number) {
  const quality = latencyQuality(ms);
  if (quality === "fast") return "success" as const;
  if (quality === "medium") return "warning" as const;
  return "danger" as const;
}

export function aiCostUsd(breakdown: CallCostBreakdown): number {
  return (breakdown.openaiUsd ?? 0) + (breakdown.sttUsd ?? 0);
}

export function buildCostSlices(
  breakdown: CallCostBreakdown,
  labels: Record<keyof typeof COST_SLICE_COLORS, string>
): CostSlice[] {
  const items = [
    { key: "telephony" as const, label: labels.telephony, value: breakdown.telnyxUsd ?? 0 },
    { key: "platform" as const, label: labels.platform, value: breakdown.platformUsd ?? 0 },
    { key: "ai" as const, label: labels.ai, value: aiCostUsd(breakdown) },
    { key: "voice" as const, label: labels.voice, value: breakdown.elevenlabsUsd ?? 0 },
    { key: "recording" as const, label: labels.recording, value: breakdown.recordingUsd ?? 0 },
  ].filter((item) => item.value > 0);

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return items.map((item) => ({
    ...item,
    color: COST_SLICE_COLORS[item.key],
    percent: total > 0 ? (item.value / total) * 100 : 0,
  }));
}

export function buildSetupLatencyChart(latency: CallLatencySummary) {
  return [
    { key: "ring", labelKey: "latencyRing", value: latency.ringMs ?? 0, color: "#60a5fa" },
    { key: "answer", labelKey: "latencyAnswer", value: latency.answerMs ?? 0, color: "#34d399" },
    { key: "talk", labelKey: "latencyTalk", value: latency.talkMs ?? 0, color: "#a78bfa" },
  ].filter((item) => item.value > 0);
}

export function buildTurnLatencyChart(turns: CallLatencySummary["turns"]) {
  return turns.map((turn, index) => ({
    key: `${turn.userAt}-${index}`,
    label: `#${index + 1}`,
    value: turn.latencyMs,
    color:
      latencyQuality(turn.latencyMs) === "fast"
        ? "#22c55e"
        : latencyQuality(turn.latencyMs) === "medium"
          ? "#f59e0b"
          : "#ef4444",
  }));
}
