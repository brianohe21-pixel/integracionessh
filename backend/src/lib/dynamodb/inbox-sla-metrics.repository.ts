import { listBots } from "./bot.repository.js";
import { listAllConversationsForBot } from "./metrics.repository.js";
import { getTenant } from "./tenant.repository.js";
import {
  getConversationSlaStatus,
  resolveInboxSlaSettings,
} from "../advisor/inbox-sla.js";
import type { Conversation, InboxSlaAdvisorMetric, InboxSlaMetrics } from "../../types/index.js";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function getInboxSlaMetrics(tenantId: string): Promise<InboxSlaMetrics> {
  const tenant = await getTenant(tenantId);
  const settings = resolveInboxSlaSettings(tenant?.inboxSla);

  if (!settings.enabled) {
    return {
      enabled: false,
      openBreached: 0,
      openAtRisk: 0,
      metCount: 0,
      missedCount: 0,
      complianceRate: 0,
      averageResponseSeconds: 0,
      byAdvisor: [],
    };
  }

  const bots = await listBots(tenantId);
  const conversations: Conversation[] = [];

  for (const bot of bots) {
    const botConversations = await listAllConversationsForBot(tenantId, bot.botId);
    conversations.push(...botConversations);
  }

  const nowMs = Date.now();
  let openBreached = 0;
  let openAtRisk = 0;
  let metCount = 0;
  let missedCount = 0;
  let totalResponseSeconds = 0;
  let responseSamples = 0;

  const advisorStats = new Map<string, { met: number; missed: number }>();

  for (const conversation of conversations) {
    if ((conversation.handoffMode ?? "bot") !== "human" || !conversation.handoffAt) continue;

    const status = getConversationSlaStatus(conversation, settings, nowMs);

    if (status === "breached") openBreached++;
    if (status === "at_risk") openAtRisk++;

    if (status === "met" || status === "missed") {
      if (status === "met") metCount++;
      if (status === "missed") missedCount++;

      const advisorId = conversation.assignedAdvisorId ?? "unassigned";
      const current = advisorStats.get(advisorId) ?? { met: 0, missed: 0 };
      if (status === "met") current.met++;
      if (status === "missed") current.missed++;
      advisorStats.set(advisorId, current);
    }

    if (conversation.firstHumanResponseAt) {
      const waitMs =
        new Date(conversation.firstHumanResponseAt).getTime() -
        new Date(conversation.handoffAt).getTime();
      if (waitMs >= 0) {
        totalResponseSeconds += waitMs / 1000;
        responseSamples++;
      }
    }
  }

  const byAdvisor: InboxSlaAdvisorMetric[] = [...advisorStats.entries()]
    .map(([advisorId, stats]) => ({
      advisorId,
      metCount: stats.met,
      missedCount: stats.missed,
      complianceRate: rate(stats.met, stats.met + stats.missed),
    }))
    .sort((a, b) => b.missedCount - a.missedCount || b.metCount - a.metCount);

  return {
    enabled: true,
    firstResponseMinutes: settings.firstResponseMinutes,
    openBreached,
    openAtRisk,
    metCount,
    missedCount,
    complianceRate: rate(metCount, metCount + missedCount),
    averageResponseSeconds:
      responseSamples > 0 ? Math.round(totalResponseSeconds / responseSamples) : 0,
    byAdvisor,
  };
}
