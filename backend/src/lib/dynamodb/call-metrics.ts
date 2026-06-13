import type { CallRecord, CallingMetrics, CallingMetricsBotRow, CallingMetricsHealth } from "../../types/index.js";

export const META_PICKUP_RATE_THRESHOLD = 50;

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function callTimestamp(call: CallRecord): string {
  return call.startedAt ?? call.createdAt;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateRangeFromDays(days: number, now = new Date()): { from: string; to: string } {
  const clampedDays = Math.min(Math.max(days, 1), 90);
  const to = formatDateUtc(now);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (clampedDays - 1));
  return { from: formatDateUtc(start), to };
}

function shiftDateUtc(dateStr: string, dayDelta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return formatDateUtc(date);
}

export function resolveMetricsDateRange(input: {
  from?: string;
  to?: string;
  days?: number;
}): { from: string; to: string } {
  if (input.from && input.to && DATE_ONLY.test(input.from) && DATE_ONLY.test(input.to)) {
    let from = input.from;
    let to = input.to;
    if (from > to) [from, to] = [to, from];
    const maxFrom = shiftDateUtc(to, -89);
    if (from < maxFrom) from = maxFrom;
    return { from, to };
  }
  return dateRangeFromDays(input.days ?? 7);
}

export function isWithinDateRange(iso: string, from: string, to: string): boolean {
  const ts = new Date(iso).getTime();
  const fromTs = Date.parse(`${from}T00:00:00.000Z`);
  const toTs = Date.parse(`${to}T23:59:59.999Z`);
  return ts >= fromTs && ts <= toTs;
}

export function isWithinDays(iso: string, days: number, now = Date.now()): boolean {
  const range = dateRangeFromDays(days, new Date(now));
  return isWithinDateRange(iso, range.from, range.to);
}

function daysBetweenInclusive(from: string, to: string): number {
  const fromTs = Date.parse(`${from}T00:00:00.000Z`);
  const toTs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.floor((toTs - fromTs) / (24 * 60 * 60 * 1000)) + 1;
}

export function isOutboundAttempt(call: CallRecord): boolean {
  return call.direction === "BUSINESS_INITIATED";
}

export function isPickedUp(call: CallRecord): boolean {
  if (!isOutboundAttempt(call)) return false;
  if (call.status === "accepted" || call.status === "completed") return true;
  return (call.duration ?? 0) > 0;
}

export function isMissedOutbound(call: CallRecord): boolean {
  return isOutboundAttempt(call) && !isPickedUp(call);
}

export function averageDurationSeconds(calls: CallRecord[]): number {
  const durations = calls
    .map((call) => call.duration ?? 0)
    .filter((duration) => duration > 0);
  if (durations.length === 0) return 0;
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return Math.round(total / durations.length);
}

export function pickupHealth(
  pickupRate: number,
  outboundAttempts: number
): CallingMetricsHealth {
  if (outboundAttempts < 10) return "insufficient_data";
  if (pickupRate >= META_PICKUP_RATE_THRESHOLD) return "healthy";
  return "at_risk";
}

function aggregateCalls(calls: CallRecord[]) {
  const outbound = calls.filter(isOutboundAttempt);
  const pickedUp = outbound.filter(isPickedUp);
  const missed = outbound.filter(isMissedOutbound);
  const inbound = calls.filter((call) => call.direction === "USER_INITIATED");
  const inboundAnswered = inbound.filter(
    (call) => call.status === "accepted" || call.status === "completed" || (call.duration ?? 0) > 0
  );
  const completedWithDuration = calls.filter((call) => (call.duration ?? 0) > 0);

  const pickupRate = rate(pickedUp.length, outbound.length);
  const inboundAnswerRate = rate(inboundAnswered.length, inbound.length);

  return {
    totalCalls: calls.length,
    outboundAttempts: outbound.length,
    outboundPickedUp: pickedUp.length,
    outboundMissed: missed.length,
    inboundCalls: inbound.length,
    inboundAnswered: inboundAnswered.length,
    pickupRate,
    inboundAnswerRate,
    averageDurationSeconds: averageDurationSeconds(completedWithDuration),
    health: pickupHealth(pickupRate, outbound.length),
  };
}

export function buildCallingMetrics(
  calls: CallRecord[],
  range: { from: string; to: string },
  botNames: Map<string, string>
): CallingMetrics {
  const filtered = calls.filter((call) =>
    isWithinDateRange(callTimestamp(call), range.from, range.to)
  );
  const summary = aggregateCalls(filtered);

  const byBotMap = new Map<string, CallRecord[]>();
  for (const call of filtered) {
    const bucket = byBotMap.get(call.botId) ?? [];
    bucket.push(call);
    byBotMap.set(call.botId, bucket);
  }

  const byBot: CallingMetricsBotRow[] = [...byBotMap.entries()]
    .map(([botId, botCalls]) => {
      const stats = aggregateCalls(botCalls);
      return {
        botId,
        botName: botNames.get(botId) ?? botId,
        ...stats,
      };
    })
    .sort((a, b) => b.outboundAttempts - a.outboundAttempts);

  return {
    from: range.from,
    to: range.to,
    windowDays: daysBetweenInclusive(range.from, range.to),
    metaPickupThreshold: META_PICKUP_RATE_THRESHOLD,
    summary,
    byBot,
  };
}
