import { listBots } from "./bot.repository.js";
import { listAdvisors } from "./advisor.repository.js";
import { listAllConversationsForBot } from "./metrics.repository.js";
import { getTenant } from "./tenant.repository.js";
import { isWithinDateRange } from "./call-metrics.js";
import {
  getConversationSlaStatus,
  resolveInboxSlaSettings,
} from "../advisor/inbox-sla.js";
import type {
  AdvisorWorkloadMetric,
  AdvisorWorkloadMetrics,
  AdvisorWorkloadUnassigned,
  Conversation,
  WorkflowStatus,
} from "../../types/index.js";

function emptyCounts(): Omit<AdvisorWorkloadMetric, "advisorId" | "name"> {
  return {
    open: 0,
    new: 0,
    pending: 0,
    totalActive: 0,
    slaBreached: 0,
    slaAtRisk: 0,
  };
}

function incrementWorkflow(
  counts: Omit<AdvisorWorkloadMetric, "advisorId" | "name">,
  workflowStatus: WorkflowStatus | undefined
): void {
  counts.totalActive++;
  const ws = workflowStatus ?? "open";
  if (ws === "new") counts.new++;
  else if (ws === "pending") counts.pending++;
  else if (ws === "open") counts.open++;
}

function isHumanConversation(conversation: Conversation): boolean {
  return (conversation.handoffMode ?? "bot") === "human";
}

function conversationHandoffAt(conversation: Conversation): string {
  return conversation.handoffAt ?? conversation.createdAt;
}

function shouldIncludeConversation(
  conversation: Conversation,
  options?: { from?: string; to?: string }
): boolean {
  if (!isHumanConversation(conversation)) return false;

  if (!options?.from || !options?.to) {
    return (conversation.workflowStatus ?? "open") !== "resolved";
  }

  return isWithinDateRange(conversationHandoffAt(conversation), options.from, options.to);
}

export async function getAdvisorWorkloadMetrics(
  tenantId: string,
  options?: { botId?: string; from?: string; to?: string }
): Promise<AdvisorWorkloadMetrics> {
  const [tenant, advisors, bots] = await Promise.all([
    getTenant(tenantId),
    listAdvisors(tenantId),
    listBots(tenantId),
  ]);

  const scopedBots = options?.botId
    ? bots.filter((bot) => bot.botId === options.botId)
    : bots;

  const slaSettings = resolveInboxSlaSettings(tenant?.inboxSla);
  const nowMs = Date.now();

  const advisorMap = new Map<string, AdvisorWorkloadMetric>();
  for (const advisor of advisors) {
    if (advisor.status !== "active") continue;
    advisorMap.set(advisor.advisorId, {
      advisorId: advisor.advisorId,
      name: advisor.name,
      ...emptyCounts(),
    });
  }

  const unassigned: AdvisorWorkloadUnassigned = {
    count: 0,
    ...emptyCounts(),
  };

  for (const bot of scopedBots) {
    const conversations = await listAllConversationsForBot(tenantId, bot.botId);
    for (const conversation of conversations) {
      if (!shouldIncludeConversation(conversation, options)) continue;

      const slaStatus = getConversationSlaStatus(conversation, slaSettings, nowMs);
      const breached = slaStatus === "breached" ? 1 : 0;
      const atRisk = slaStatus === "at_risk" ? 1 : 0;

      if (!conversation.assignedAdvisorId) {
        unassigned.count++;
        incrementWorkflow(unassigned, conversation.workflowStatus);
        unassigned.slaBreached += breached;
        unassigned.slaAtRisk += atRisk;
        continue;
      }

      const entry = advisorMap.get(conversation.assignedAdvisorId);
      if (!entry) continue;

      incrementWorkflow(entry, conversation.workflowStatus);
      entry.slaBreached += breached;
      entry.slaAtRisk += atRisk;
    }
  }

  const advisorsList = [...advisorMap.values()].sort(
    (a, b) => b.totalActive - a.totalActive || a.name.localeCompare(b.name)
  );

  return { advisors: advisorsList, unassigned };
}
