import type { CallCostBreakdown, CallRecord } from "@/types";
import { COST_SLICE_COLORS } from "@/lib/voice-agent-call-visuals";

export const SUMMARY_CHART_DAYS = 14;

export interface VoiceAgentSummaryStats {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  totalMinutes: number;
  totalCost: number;
  avgDurationSeconds: number;
  completionRate: number;
  recordingsReady: number;
}

export interface VoiceAgentDailyPoint {
  key: string;
  label: string;
  calls: number;
  completed: number;
  costUsd: number;
}

export interface VoiceAgentSeriesPoint {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface VoiceAgentCostSlice {
  key: keyof typeof COST_SLICE_COLORS;
  label: string;
  value: number;
  color: string;
  percent: number;
}

export function getCallTimestamp(call: CallRecord): string {
  return call.startedAt ?? call.createdAt;
}

function isFailedStatus(status: CallRecord["status"]): boolean {
  return status === "failed" || status === "rejected" || status === "terminated";
}

export function buildVoiceAgentSummaryStats(calls: CallRecord[]): VoiceAgentSummaryStats {
  const completed = calls.filter((call) => call.status === "completed");
  const failed = calls.filter((call) => isFailedStatus(call.status));
  const inbound = calls.filter((call) => call.direction === "USER_INITIATED");
  const outbound = calls.filter((call) => call.direction === "BUSINESS_INITIATED");
  const totalDuration = completed.reduce((sum, call) => sum + (call.duration ?? 0), 0);
  const totalCost = calls.reduce((sum, call) => sum + (call.costBreakdown?.totalUsd ?? 0), 0);
  const recordingsReady = calls.filter((call) => call.recordingStatus === "ready").length;

  return {
    totalCalls: calls.length,
    completedCalls: completed.length,
    failedCalls: failed.length,
    inboundCalls: inbound.length,
    outboundCalls: outbound.length,
    totalMinutes: Math.ceil(totalDuration / 60),
    totalCost,
    avgDurationSeconds:
      completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
    completionRate: calls.length > 0 ? Math.round((completed.length / calls.length) * 100) : 0,
    recordingsReady,
  };
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildVoiceAgentDailySeries(
  calls: CallRecord[],
  locale: string,
  days = SUMMARY_CHART_DAYS
): VoiceAgentDailyPoint[] {
  const today = startOfLocalDay(new Date());
  const buckets = new Map<string, VoiceAgentDailyPoint>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = formatDayKey(date);
    buckets.set(key, {
      key,
      label: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date),
      calls: 0,
      completed: 0,
      costUsd: 0,
    });
  }

  for (const call of calls) {
    const timestamp = new Date(getCallTimestamp(call));
    if (Number.isNaN(timestamp.getTime())) continue;
    const key = formatDayKey(startOfLocalDay(timestamp));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.calls += 1;
    if (call.status === "completed") bucket.completed += 1;
    bucket.costUsd += call.costBreakdown?.totalUsd ?? 0;
  }

  return Array.from(buckets.values());
}

export function buildVoiceAgentDirectionSeries(
  calls: CallRecord[],
  labels: { inbound: string; outbound: string }
): VoiceAgentSeriesPoint[] {
  const inbound = calls.filter((call) => call.direction === "USER_INITIATED").length;
  const outbound = calls.filter((call) => call.direction === "BUSINESS_INITIATED").length;

  return [
    { key: "inbound", label: labels.inbound, value: inbound, color: "#3b82f6" },
    { key: "outbound", label: labels.outbound, value: outbound, color: "#128c7e" },
  ].filter((item) => item.value > 0);
}

const STATUS_COLORS: Partial<Record<CallRecord["status"], string>> = {
  completed: "#22c55e",
  accepted: "#14b8a6",
  initiated: "#94a3b8",
  ringing: "#f59e0b",
  failed: "#ef4444",
  rejected: "#f97316",
  terminated: "#dc2626",
  voicemail: "#eab308",
};

export function buildVoiceAgentStatusSeries(
  calls: CallRecord[],
  statusLabels: Record<CallRecord["status"], string>
): VoiceAgentSeriesPoint[] {
  const counts = new Map<CallRecord["status"], number>();

  for (const call of calls) {
    counts.set(call.status, (counts.get(call.status) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([status, value]) => ({
      key: status,
      label: statusLabels[status],
      value,
      color: STATUS_COLORS[status] ?? "#64748b",
    }))
    .sort((a, b) => b.value - a.value);
}

function aiCostUsd(breakdown: CallCostBreakdown): number {
  return (breakdown.openaiUsd ?? 0) + (breakdown.sttUsd ?? 0);
}

function sumCostField(
  calls: CallRecord[],
  picker: (breakdown: CallCostBreakdown) => number | undefined
): number {
  return calls.reduce((sum, call) => sum + (picker(call.costBreakdown ?? { totalUsd: 0, currency: "USD", pricingVersion: "" }) ?? 0), 0);
}

export function buildVoiceAgentAggregatedCostSlices(
  calls: CallRecord[],
  labels: Record<keyof typeof COST_SLICE_COLORS, string>
): VoiceAgentCostSlice[] {
  const items = [
    {
      key: "telephony" as const,
      label: labels.telephony,
      value: sumCostField(calls, (breakdown) => breakdown.telnyxUsd),
      color: COST_SLICE_COLORS.telephony,
    },
    {
      key: "platform" as const,
      label: labels.platform,
      value: sumCostField(calls, (breakdown) => breakdown.platformUsd),
      color: COST_SLICE_COLORS.platform,
    },
    {
      key: "ai" as const,
      label: labels.ai,
      value: sumCostField(calls, aiCostUsd),
      color: COST_SLICE_COLORS.ai,
    },
    {
      key: "voice" as const,
      label: labels.voice,
      value: sumCostField(calls, (breakdown) => breakdown.elevenlabsUsd),
      color: COST_SLICE_COLORS.voice,
    },
    {
      key: "recording" as const,
      label: labels.recording,
      value: sumCostField(calls, (breakdown) => breakdown.recordingUsd),
      color: COST_SLICE_COLORS.recording,
    },
  ].filter((item) => item.value > 0);

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return items.map((item) => ({
    ...item,
    percent: total > 0 ? (item.value / total) * 100 : 0,
  }));
}
