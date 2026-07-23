import type { Conversation, InboxSlaSettings, InboxSlaStatus } from "@/types";

export const DEFAULT_INBOX_SLA: InboxSlaSettings = {
  enabled: false,
  firstResponseMinutes: 5,
};

export const SLA_AT_RISK_RATIO = 0.8;

export function resolveInboxSlaSettings(settings?: InboxSlaSettings | null): InboxSlaSettings {
  return {
    enabled: settings?.enabled ?? DEFAULT_INBOX_SLA.enabled,
    firstResponseMinutes:
      settings?.firstResponseMinutes ?? DEFAULT_INBOX_SLA.firstResponseMinutes,
  };
}

export function slaThresholdMs(settings: InboxSlaSettings): number {
  return settings.firstResponseMinutes * 60 * 1000;
}

export function getConversationSlaStatus(
  conversation: Pick<
    Conversation,
    "handoffMode" | "handoffAt" | "firstHumanResponseAt" | "workflowStatus"
  >,
  settings: InboxSlaSettings,
  nowMs: number = Date.now()
): InboxSlaStatus {
  if (!settings.enabled) return "disabled";
  if ((conversation.handoffMode ?? "bot") !== "human" || !conversation.handoffAt) {
    return "disabled";
  }

  const thresholdMs = slaThresholdMs(settings);
  const handoffMs = new Date(conversation.handoffAt).getTime();
  if (!Number.isFinite(handoffMs)) return "disabled";

  if (conversation.firstHumanResponseAt) {
    const responseMs = new Date(conversation.firstHumanResponseAt).getTime();
    if (!Number.isFinite(responseMs)) return "disabled";
    const waitMs = responseMs - handoffMs;
    if (waitMs < 0) return "disabled";
    return waitMs <= thresholdMs ? "met" : "missed";
  }

  if (conversation.workflowStatus === "resolved") return "disabled";

  const elapsedMs = nowMs - handoffMs;
  if (elapsedMs < 0) return "ok";
  if (elapsedMs >= thresholdMs) return "breached";
  if (elapsedMs >= thresholdMs * SLA_AT_RISK_RATIO) return "at_risk";
  return "ok";
}

export function getElapsedSecondsSinceHandoff(
  handoffAt: string | undefined,
  nowMs: number = Date.now()
): number | null {
  if (!handoffAt) return null;
  const handoffMs = new Date(handoffAt).getTime();
  if (!Number.isFinite(handoffMs)) return null;
  const elapsedMs = nowMs - handoffMs;
  if (elapsedMs < 0) return 0;
  return Math.floor(elapsedMs / 1000);
}

export function formatElapsedDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
