"use client";

import { useMemo, useState } from "react";
import {
  UserPlus,
  LayoutGrid,
  List,
  ChevronRight,
  FilterX,
  TrendingUp,
  Clock,
  Calendar,
  Target,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useLeads, useLeadMetrics, useUpdateLead } from "@/hooks/useLeads";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableRow } from "@/components/ui/DataTable";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFormatters } from "@/hooks/useFormatters";
import type { Lead, LeadStatus } from "@/types";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];
const KANBAN_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

function statusVariant(status: LeadStatus): "success" | "warning" | "danger" | "default" | "info" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  if (status === "qualified") return "info";
  if (status === "contacted") return "warning";
  return "default";
}

function leadInitials(name?: string, phone?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return phone?.slice(-2) ?? "?";
}

export default function LeadsPage() {
  const t = useT();
  const { formatDate } = useFormatters();
  const [view, setView] = useState<"table" | "kanban">("table");
  const [statusFilter, setStatusFilter] = useState<"" | LeadStatus>("");
  const [botFilter, setBotFilter] = useState("");
  const [metaAdsOnly, setMetaAdsOnly] = useState(false);
  const [q, setQ] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const hasFilters = statusFilter || botFilter || metaAdsOnly || q;

  const { data: bots } = useBots();
  const { data, isLoading } = useLeads({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(botFilter ? { botId: botFilter } : {}),
    ...(metaAdsOnly ? { adsOnly: true } : {}),
    ...(q ? { q } : {}),
  });
  const { data: metrics } = useLeadMetrics();
  const updateLead = useUpdateLead();

  const leads = useMemo(() => data?.items ?? [], [data?.items]);

  const activeLead = selectedLead
    ? leads.find((l) => l.leadId === selectedLead.leadId) ?? selectedLead
    : null;

  const activeCount = useMemo(
    () => leads.filter((l) => ["new", "contacted", "qualified"].includes(l.status)).length,
    [leads]
  );

  async function handleKanbanDrop(leadId: string, newStatus: LeadStatus) {
    const lead = leads.find((l) => l.leadId === leadId);
    if (!lead || lead.status === newStatus) return;
    if (lead.status === "converted" || lead.status === "lost") return;
    if (newStatus === "converted" || newStatus === "lost") return;
    await updateLead.mutateAsync({ leadId, status: newStatus });
  }

  function clearFilters() {
    setQ("");
    setStatusFilter("");
    setBotFilter("");
    setMetaAdsOnly(false);
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("leads.title")}
        subtitle={t("leads.subtitle")}
        actions={
          <div className="flex gap-1">
            <Button
              type="button"
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("table")}
              aria-label={t("leads.viewTable")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("kanban")}
              aria-label={t("leads.viewKanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {metrics && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard
            label={t("leads.metricsTotal")}
            value={String(metrics.total)}
            icon={<UserPlus className="h-5 w-5 text-accent" />}
          />
          <StatCard
            label={t("leads.metricsToday")}
            value={String(metrics.capturedToday)}
            icon={<Calendar className="h-5 w-5 text-accent" />}
          />
          <StatCard
            label={t("leads.metricsWeek")}
            value={String(metrics.capturedThisWeek)}
            icon={<TrendingUp className="h-5 w-5 text-success" />}
          />
          <StatCard
            label={t("leads.metricsConversionRate")}
            value={`${metrics.conversionRate}%`}
            icon={<Target className="h-5 w-5 text-info" />}
          />
          <StatCard
            label={t("leads.metricsAvgHours")}
            value={`${metrics.averageConversionHours}h`}
            icon={<Clock className="h-5 w-5 text-warning" />}
          />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("leads.searchPlaceholder")}
          onClear={() => setQ("")}
          className="sm:min-w-[240px] sm:flex-1"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | LeadStatus)}
          className="sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{t("leads.filterAllStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`leads.status_${s}`)}</option>
          ))}
        </Select>
        <Select
          value={botFilter}
          onChange={(e) => setBotFilter(e.target.value)}
          className="sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{t("automations.allBots")}</option>
          {(bots ?? []).map((b) => (
            <option key={b.botId} value={b.botId}>{b.name}</option>
          ))}
        </Select>
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={metaAdsOnly}
            onChange={(event) => setMetaAdsOnly(event.target.checked)}
            className="rounded border-default text-accent focus:ring-accent"
          />
          {t("leads.filterMetaAds")}
        </label>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <FilterX className="h-4 w-4" />
            {t("common.clearFilters")}
          </Button>
        )}
      </div>

      {isLoading && <SkeletonTable rows={6} cols={5} className="mb-4" />}

      {!isLoading && leads.length === 0 && (
        <EmptyState
          icon={<UserPlus className="w-6 h-6" />}
          title={hasFilters ? t("leads.noResultsTitle") : t("leads.emptyTitle")}
          description={hasFilters ? t("leads.noResultsDescription") : t("leads.emptyDescription")}
          action={
            hasFilters ? (
              <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                {t("common.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && leads.length > 0 && view === "table" && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-secondary">
              {t("leads.shownCount", { count: leads.length })}
              {activeCount > 0 && (
                <span className="ml-2 text-muted">
                  · {t("leads.activeCount", { count: activeCount })}
                </span>
              )}
            </p>
          </div>

          <DataTable minWidth="800px">
            <DataTableHead>
              <DataTableRow className="border-b border-default bg-surface-muted/60 text-xs uppercase tracking-wide text-secondary">
                <DataTableCell header>{t("leads.colLead")}</DataTableCell>
                <DataTableCell header>{t("leads.colBot")}</DataTableCell>
                <DataTableCell header>{t("common.status")}</DataTableCell>
                <DataTableCell header>{t("common.date")}</DataTableCell>
                <DataTableCell header className="w-10">
                  <span className="sr-only">{t("leads.colActions")}</span>
                </DataTableCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody className="divide-y divide-subtle">
              {leads.map((lead) => {
                const botName = bots?.find((b) => b.botId === lead.botId)?.name ?? "—";
                const initials = leadInitials(lead.name, lead.phone);
                return (
                  <DataTableRow
                    key={lead.leadId}
                    className="group cursor-pointer transition-colors hover:bg-surface-muted/50"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <DataTableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-xs font-semibold text-accent">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-primary">
                            {lead.name ?? t("leads.unnamed")}
                          </p>
                          <p className="truncate font-mono text-xs text-secondary">{lead.phone}</p>
                          {lead.email && (
                            <p className="truncate text-xs text-muted">{lead.email}</p>
                          )}
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-sm text-secondary">{botName}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(lead.status)}>
                        {t(`leads.status_${lead.status}`)}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-sm text-secondary">{formatDate(lead.createdAt)}</span>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </>
      )}

      {!isLoading && leads.length > 0 && view === "kanban" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {KANBAN_STATUSES.map((status) => {
            const columnLeads = leads.filter((l) => l.status === status);
            const isDraggable = status !== "converted" && status !== "lost";
            return (
              <div
                key={status}
                className="min-h-[240px] rounded-xl border border-default bg-surface p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const leadId = e.dataTransfer.getData("leadId");
                  if (leadId) void handleKanbanDrop(leadId, status);
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                    {t(`leads.status_${status}`)}
                  </h3>
                  <Badge variant="default">{columnLeads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.leadId}
                      draggable={isDraggable}
                      onDragStart={(e) => e.dataTransfer.setData("leadId", lead.leadId)}
                      onClick={() => setSelectedLead(lead)}
                      className="cursor-pointer rounded-lg border border-default bg-surface-elevated p-3 text-sm transition-colors hover:border-accent/30"
                    >
                      <p className="truncate font-medium text-primary">
                        {lead.name ?? lead.phone}
                      </p>
                      {lead.email && (
                        <p className="truncate text-xs text-secondary">{lead.email}</p>
                      )}
                      <p className="mt-1 font-mono text-xs text-muted">{lead.phone}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeLead && (
        <LeadDetailPanel
          key={activeLead.leadId + activeLead.updatedAt}
          lead={activeLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </DashboardPage>
  );
}
