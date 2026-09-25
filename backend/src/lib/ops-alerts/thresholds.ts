import type { PlanLimits } from "../billing/plan-limits.js";

export function planUsagePercentages(
  usage: {
    messagesCount: number;
    campaignsStarted: number;
    bulkRecipientsCount: number;
    voicebotMinutesCount?: number;
  },
  limits: Pick<
    PlanLimits,
    | "maxMessagesPerMonth"
    | "maxActiveCampaigns"
    | "maxBulkRecipientsPerJob"
    | "maxVoicebotMinutesPerMonth"
  >
): {
  messages: number | null;
  campaigns: number | null;
  bulk: number | null;
  voicebotMinutes: number | null;
} {
  function pct(used: number, max: number): number | null {
    if (!Number.isFinite(max) || max <= 0 || max >= Number.MAX_SAFE_INTEGER) return null;
    return Math.round((used / max) * 1000) / 10;
  }

  return {
    messages: pct(usage.messagesCount, limits.maxMessagesPerMonth),
    campaigns: pct(usage.campaignsStarted, limits.maxActiveCampaigns),
    bulk: pct(usage.bulkRecipientsCount, limits.maxBulkRecipientsPerJob),
    voicebotMinutes: pct(usage.voicebotMinutesCount ?? 0, limits.maxVoicebotMinutesPerMonth),
  };
}

export function telephonySpendUsd(
  calls: Array<{ costBreakdown?: { totalUsd?: number } | null }>
): number {
  const total = calls.reduce((sum, call) => sum + (call.costBreakdown?.totalUsd ?? 0), 0);
  return Math.round(total * 100) / 100;
}
