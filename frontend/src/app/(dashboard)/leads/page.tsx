"use client";

import { useState } from "react";
import { UserPlus, LayoutGrid, List } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useLeads, useLeadMetrics, useUpdateLead } from "@/hooks/useLeads";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";
import type { Lead, LeadStatus } from "@/types";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

function statusVariant(status: LeadStatus): "success" | "warning" | "danger" | "default" | "info" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  if (status === "qualified") return "info";
  if (status === "contacted") return "warning";
  return "default";
}

export default function LeadsPage() {
  const t = useT();
  const [view, setView] = useState<"table" | "kanban">("table");
  const [statusFilter, setStatusFilter] = useState<"" | LeadStatus>("");
  const [botFilter, setBotFilter] = useState("");
  const [q, setQ] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data: bots } = useBots();
  const { data, isLoading } = useLeads({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(botFilter ? { botId: botFilter } : {}),
    ...(q ? { q } : {}),
  });
  const { data: metrics } = useLeadMetrics();
  const updateLead = useUpdateLead();

  const leads = data?.items ?? [];

  async function handleKanbanDrop(leadId: string, newStatus: LeadStatus) {
    const lead = leads.find((l) => l.leadId === leadId);
    if (!lead || lead.status === newStatus) return;
    if (lead.status === "converted" || lead.status === "lost") return;
    if (newStatus === "converted" || newStatus === "lost") return;
    await updateLead.mutateAsync({ leadId, status: newStatus });
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("leads.title")}
        subtitle={t("leads.subtitle")}
      />

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-surface-elevated rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">{t("leads.metricsTotal")}</p>
            <p className="text-xl font-bold text-primary">{metrics.total}</p>
          </div>
          <div className="bg-surface-elevated rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">{t("leads.metricsToday")}</p>
            <p className="text-xl font-bold text-primary">{metrics.capturedToday}</p>
          </div>
          <div className="bg-surface-elevated rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">{t("leads.metricsWeek")}</p>
            <p className="text-xl font-bold text-primary">{metrics.capturedThisWeek}</p>
          </div>
          <div className="bg-surface-elevated rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">{t("leads.metricsConversionRate")}</p>
            <p className="text-xl font-bold text-primary">{metrics.conversionRate}%</p>
          </div>
          <div className="bg-surface-elevated rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">{t("leads.metricsAvgHours")}</p>
            <p className="text-xl font-bold text-primary">{metrics.averageConversionHours}h</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("leads.searchPlaceholder")}
          className="px-3 py-2 border border-default rounded-lg text-sm min-w-[200px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | LeadStatus)}
          className="px-3 py-2 border border-default rounded-lg text-sm"
        >
          <option value="">{t("leads.filterAllStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`leads.status_${s}`)}</option>
          ))}
        </select>
        <select
          value={botFilter}
          onChange={(e) => setBotFilter(e.target.value)}
          className="px-3 py-2 border border-default rounded-lg text-sm"
        >
          <option value="">{t("automations.allBots")}</option>
          {(bots ?? []).map((b) => (
            <option key={b.botId} value={b.botId}>{b.name}</option>
          ))}
        </select>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setView("table")}
            className={`p-2 rounded-lg border ${view === "table" ? "bg-accent-muted border-accent/30 text-accent" : "border-default text-secondary"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`p-2 rounded-lg border ${view === "kanban" ? "bg-accent-muted border-accent/30 text-accent" : "border-default text-secondary"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse bg-surface-muted rounded-xl" />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="w-6 h-6" />}
          title={t("leads.emptyTitle")}
          description={t("leads.emptyDescription")}
        />
      ) : view === "table" ? (
        <div className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
          <TableContainer>
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-surface border-b border-default">
                <tr className="text-left text-secondary">
                  <th className="px-4 py-3">{t("leads.colName")}</th>
                  <th className="px-4 py-3">{t("common.phone")}</th>
                  <th className="px-4 py-3">{t("common.email")}</th>
                  <th className="px-4 py-3">{t("leads.colBot")}</th>
                  <th className="px-4 py-3">{t("common.status")}</th>
                  <th className="px-4 py-3">{t("common.date")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const botName = bots?.find((b) => b.botId === lead.botId)?.name ?? "—";
                  return (
                    <tr key={lead.leadId} className="border-b border-subtle hover:bg-surface">
                      <td className="px-4 py-3 font-medium text-primary">{lead.name ?? "—"}</td>
                      <td className="px-4 py-3 text-secondary">{lead.phone}</td>
                      <td className="px-4 py-3 text-secondary">{lead.email ?? "—"}</td>
                      <td className="px-4 py-3 text-secondary">{botName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(lead.status)}>
                          {t(`leads.status_${lead.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {new Date(lead.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLead(lead)}
                          className="text-accent hover:text-accent text-sm"
                        >
                          {t("common.edit")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(["new", "contacted", "qualified", "converted", "lost"] as LeadStatus[]).map((status) => (
            <div
              key={status}
              className="bg-surface rounded-xl border border-default p-3 min-h-[200px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const leadId = e.dataTransfer.getData("leadId");
                if (leadId) void handleKanbanDrop(leadId, status);
              }}
            >
              <h3 className="text-xs font-semibold text-secondary uppercase mb-3">
                {t(`leads.status_${status}`)} ({leads.filter((l) => l.status === status).length})
              </h3>
              <div className="space-y-2">
                {leads
                  .filter((l) => l.status === status)
                  .map((lead) => (
                    <div
                      key={lead.leadId}
                      draggable={status !== "converted" && status !== "lost"}
                      onDragStart={(e) => e.dataTransfer.setData("leadId", lead.leadId)}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-surface-elevated rounded-lg border border-default p-3 cursor-pointer hover:border-accent/30 text-sm"
                    >
                      <p className="font-medium text-primary truncate">{lead.name ?? lead.phone}</p>
                      {lead.email && <p className="text-xs text-secondary truncate">{lead.email}</p>}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedLead && (
        <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </DashboardPage>
  );
}
