"use client";

import { useMemo, useState } from "react";
import { Megaphone, FilterX } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useAdsLeads, useAdsLeadMetrics } from "@/hooks/useAdsLeads";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFormatters } from "@/hooks/useFormatters";
import { adsAttributionLabelKey, adsAttributionSummary } from "@/lib/meta-ads";
import type { AdsAttributionSource, Lead, LeadStatus } from "@/types";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

function statusVariant(status: LeadStatus): "success" | "warning" | "danger" | "default" | "info" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  if (status === "qualified") return "info";
  if (status === "contacted") return "warning";
  return "default";
}

export default function AdsPage() {
  const t = useT();
  const { formatDate } = useFormatters();
  const [statusFilter, setStatusFilter] = useState<"" | LeadStatus>("");
  const [botFilter, setBotFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | "meta_ctwa" | "meta_lead_ads">("");
  const [q, setQ] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data: bots } = useBots();
  const { data, isLoading } = useAdsLeads({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(botFilter ? { botId: botFilter } : {}),
    ...(sourceFilter ? { attributionSource: sourceFilter } : {}),
    ...(q ? { q } : {}),
  });
  const leads = useMemo(() => data?.items ?? [], [data?.items]);
  const metrics = useAdsLeadMetrics(leads);
  const hasFilters = statusFilter || botFilter || sourceFilter || q;

  const activeLead = selectedLead
    ? leads.find((lead) => lead.leadId === selectedLead.leadId) ?? selectedLead
    : null;

  return (
    <DashboardPage>
      <PageHeader title={t("ads.title")} subtitle={t("ads.subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("ads.metricsTotal")} value={String(metrics.total)} />
        <StatCard label={t("ads.metricsCtwa")} value={String(metrics.ctwa)} />
        <StatCard label={t("ads.metricsLeadAds")} value={String(metrics.leadAds)} />
        <StatCard
          label={t("ads.metricsConversionRate")}
          value={`${metrics.conversionRate}%`}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("ads.searchPlaceholder")}
          className="min-w-[220px] flex-1"
        />
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "" | LeadStatus)}
        >
          <option value="">{t("ads.filterAllStatus")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`leads.status_${status}`)}
            </option>
          ))}
        </Select>
        <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "" | "meta_ctwa" | "meta_lead_ads")}>
          <option value="">{t("ads.filterAllSources")}</option>
          <option value="meta_ctwa">{t("ads.sourceCtwa")}</option>
          <option value="meta_lead_ads">{t("ads.sourceLeadAds")}</option>
        </Select>
        <Select value={botFilter} onChange={(event) => setBotFilter(event.target.value)}>
          <option value="">{t("ads.filterAllBots")}</option>
          {(bots ?? []).map((bot) => (
            <option key={bot.botId} value={bot.botId}>
              {bot.name}
            </option>
          ))}
        </Select>
        {hasFilters ? (
          <Button
            variant="ghost"
            onClick={() => {
              setStatusFilter("");
              setBotFilter("");
              setSourceFilter("");
              setQ("");
            }}
          >
            <FilterX className="h-4 w-4" />
            {t("conversations.clearFilters")}
          </Button>
        ) : null}
      </div>

      {isLoading ? <SkeletonTable rows={6} cols={6} className="mt-6" /> : null}

      {!isLoading && leads.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title={hasFilters ? t("ads.noResultsTitle") : t("ads.emptyTitle")}
          description={hasFilters ? t("ads.noResultsDescription") : t("ads.emptyDescription")}
          className="mt-6 py-16"
        />
      ) : null}

      {!isLoading && leads.length > 0 ? (
        <DataTable minWidth="900px" className="mt-6">
          <DataTableHead>
            <DataTableRow className="border-b border-default bg-surface-muted/60 text-xs uppercase tracking-wide text-secondary">
              <DataTableCell header>{t("ads.colLead")}</DataTableCell>
              <DataTableCell header>{t("ads.colSource")}</DataTableCell>
              <DataTableCell header>{t("ads.colCampaign")}</DataTableCell>
              <DataTableCell header>{t("ads.colBot")}</DataTableCell>
              <DataTableCell header>{t("ads.colStatus")}</DataTableCell>
              <DataTableCell header>{t("ads.colCreated")}</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody className="divide-y divide-subtle">
            {leads.map((lead) => {
              const source = lead.attribution?.source as AdsAttributionSource | undefined;
              const botName = (bots ?? []).find((bot) => bot.botId === lead.botId)?.name ?? lead.botId;
              return (
                <DataTableRow
                  key={lead.leadId}
                  className="cursor-pointer transition-colors hover:bg-surface-muted/50"
                  onClick={() => setSelectedLead(lead)}
                >
                  <DataTableCell>
                    <div>
                      <p className="font-medium text-primary">
                        {lead.name || lead.phone || t("leads.unnamed")}
                      </p>
                      <p className="text-xs text-secondary">{lead.phone}</p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant="info">{t(adsAttributionLabelKey(source))}</Badge>
                  </DataTableCell>
                  <DataTableCell className="max-w-[220px] truncate text-secondary">
                    {adsAttributionSummary(lead.attribution) || "—"}
                  </DataTableCell>
                  <DataTableCell className="text-secondary">{botName}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusVariant(lead.status)}>
                      {t(`leads.status_${lead.status}`)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-secondary">
                    {formatDate(lead.createdAt)}
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      ) : null}

      {activeLead ? (
        <LeadDetailPanel lead={activeLead} onClose={() => setSelectedLead(null)} />
      ) : null}
    </DashboardPage>
  );
}
