import { listBots } from "../dynamodb/bot.repository.js";
import { listAllCallsForTenant } from "../dynamodb/call.repository.js";
import { listAllConversationsForBot } from "../dynamodb/metrics.repository.js";
import { getMonthlyUsage, currentUsagePeriod } from "../dynamodb/usage.repository.js";
import { getTenant, listTenants } from "../dynamodb/tenant.repository.js";
import {
  getConversationSlaStatus,
  resolveInboxSlaSettings,
} from "../advisor/inbox-sla.js";
import { getEffectivePlanLimits } from "../billing/plan-limits.js";
import { emitOpsAlert } from "./emit.js";
import {
  resolveOpsAlertsSettings,
  tenantHasActiveScanRules,
} from "./settings.js";
import { planUsagePercentages, telephonySpendUsd } from "./thresholds.js";

async function evaluateSlaBreached(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return;
  const settings = resolveOpsAlertsSettings(tenant.opsAlerts);
  const rule = settings.rules.find((item) => item.id === "sla_breached");
  if (!rule?.enabled) return;

  const sla = resolveInboxSlaSettings(tenant.inboxSla);
  if (!sla.enabled) return;

  const bots = await listBots(tenantId);
  const nowMs = Date.now();

  for (const bot of bots) {
    const conversations = await listAllConversationsForBot(tenantId, bot.botId);
    for (const conversation of conversations) {
      if ((conversation.handoffMode ?? "bot") !== "human" || !conversation.handoffAt) continue;
      if (conversation.firstHumanResponseAt) continue;
      const status = getConversationSlaStatus(conversation, sla, nowMs);
      if (status !== "breached") continue;

      await emitOpsAlert({
        tenantId,
        ruleId: "sla_breached",
        title: "Inbox SLA breached",
        body: `Conversation ${conversation.conversationId} exceeded the first-response SLA.`,
        href: `/conversations?conversationId=${encodeURIComponent(conversation.conversationId)}`,
        severity: "warning",
        dedupeKey: `sla_breached:${conversation.conversationId}`,
      });
    }
  }
}

async function evaluatePlanUsage(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return;
  const settings = resolveOpsAlertsSettings(tenant.opsAlerts);
  const rule = settings.rules.find((item) => item.id === "plan_usage");
  if (!rule?.enabled) return;

  const threshold = rule.thresholdPercent ?? 85;
  const period = currentUsagePeriod();
  const usage = await getMonthlyUsage(tenantId, period);
  const limits = getEffectivePlanLimits(tenant);
  const percentages = planUsagePercentages(usage, limits);

  const entries: Array<{ meter: string; pct: number }> = [];
  if (percentages.messages !== null && percentages.messages >= threshold) {
    entries.push({ meter: "messages", pct: percentages.messages });
  }
  if (percentages.campaigns !== null && percentages.campaigns >= threshold) {
    entries.push({ meter: "campaigns", pct: percentages.campaigns });
  }
  if (percentages.bulk !== null && percentages.bulk >= threshold) {
    entries.push({ meter: "bulk", pct: percentages.bulk });
  }
  if (percentages.voicebotMinutes !== null && percentages.voicebotMinutes >= threshold) {
    entries.push({ meter: "voicebotMinutes", pct: percentages.voicebotMinutes });
  }

  for (const entry of entries) {
    await emitOpsAlert({
      tenantId,
      ruleId: "plan_usage",
      title: "Plan usage threshold reached",
      body: `${entry.meter} usage is at ${entry.pct}% of the plan limit (threshold ${threshold}%).`,
      href: "/billing",
      severity: entry.pct >= 100 ? "critical" : "warning",
      dedupeKey: `plan_usage:${period}:${entry.meter}`,
      dedupeTtlSeconds: 40 * 24 * 60 * 60,
    });
  }
}

async function evaluateTelephonySpend(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return;
  const settings = resolveOpsAlertsSettings(tenant.opsAlerts);
  const rule = settings.rules.find((item) => item.id === "telephony_spend");
  if (!rule?.enabled) return;

  const threshold = rule.thresholdUsd ?? 50;
  const period = currentUsagePeriod();
  const calls = await listAllCallsForTenant(tenantId);
  const monthCalls = calls.filter((call) => {
    const started = call.startedAt ?? call.createdAt ?? "";
    return started.startsWith(period);
  });
  const total = telephonySpendUsd(monthCalls);
  if (total < threshold) return;

  await emitOpsAlert({
    tenantId,
    ruleId: "telephony_spend",
    title: "Telephony spend threshold reached",
    body: `Phone spend this month is $${total.toFixed(2)} (threshold $${threshold.toFixed(2)}).`,
    href: "/voice-agents",
    severity: "warning",
    dedupeKey: `telephony_spend:${period}`,
    dedupeTtlSeconds: 40 * 24 * 60 * 60,
  });
}

export async function evaluateOpsAlertsForTenant(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant || !tenantHasActiveScanRules(tenant.opsAlerts)) return;

  await evaluateSlaBreached(tenantId);
  await evaluatePlanUsage(tenantId);
  await evaluateTelephonySpend(tenantId);
}

export async function evaluateOpsAlertsForAllTenants(): Promise<void> {
  const tenants = await listTenants();
  for (const tenant of tenants) {
    if (tenant.status !== "active") continue;
    if (!tenantHasActiveScanRules(tenant.opsAlerts)) continue;
    try {
      await evaluateOpsAlertsForTenant(tenant.tenantId);
    } catch (error) {
      console.error(`Ops alerts evaluation failed for ${tenant.tenantId}:`, error);
    }
  }
}
