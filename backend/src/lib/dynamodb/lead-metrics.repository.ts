import { listAllLeads } from "./lead.repository.js";
import type { Lead, LeadMetrics, LeadStatus } from "../../types/index.js";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(now.getUTCDate() - 7);
  return d >= weekAgo;
}

export async function getLeadMetrics(tenantId: string): Promise<LeadMetrics> {
  const leads = await listAllLeads(tenantId);

  const byStatus = STATUSES.reduce(
    (acc, status) => {
      acc[status] = leads.filter((l) => l.status === status).length;
      return acc;
    },
    {} as Record<LeadStatus, number>
  );

  const capturedToday = leads.filter((l) => isToday(l.createdAt)).length;
  const capturedThisWeek = leads.filter((l) => isThisWeek(l.createdAt)).length;

  const closed = byStatus.converted + byStatus.lost;
  const conversionRate =
    closed > 0 ? Math.round((byStatus.converted / closed) * 1000) / 10 : 0;

  const convertedLeads = leads.filter((l) => l.status === "converted" && l.convertedAt);
  let averageConversionHours = 0;
  if (convertedLeads.length > 0) {
    const totalHours = convertedLeads.reduce((sum, l) => {
      const start = new Date(l.createdAt).getTime();
      const end = new Date(l.convertedAt!).getTime();
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);
    averageConversionHours = Math.round((totalHours / convertedLeads.length) * 10) / 10;
  }

  const botCounts = new Map<string, number>();
  const flowCounts = new Map<string, number>();
  for (const lead of leads) {
    botCounts.set(lead.botId, (botCounts.get(lead.botId) ?? 0) + 1);
    flowCounts.set(lead.metaFlowId, (flowCounts.get(lead.metaFlowId) ?? 0) + 1);
  }

  const topBots = [...botCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([botId, count]) => ({ botId, count }));

  const topFlows = [...flowCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([metaFlowId, count]) => ({ metaFlowId, count }));

  return {
    total: leads.length,
    byStatus,
    capturedToday,
    capturedThisWeek,
    conversionRate,
    averageConversionHours,
    topBots,
    topFlows,
    funnel: {
      new: byStatus.new,
      contacted: byStatus.contacted,
      qualified: byStatus.qualified,
      converted: byStatus.converted,
      lost: byStatus.lost,
    },
  };
}

export async function getActiveLeadForPhone(
  tenantId: string,
  phone: string
): Promise<Lead | null> {
  const { getActiveLeadByPhone } = await import("./lead.repository.js");
  return getActiveLeadByPhone(tenantId, phone);
}
