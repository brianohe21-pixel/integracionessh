"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Megaphone,
  X,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useBots } from "@/hooks/useBots";
import { useCampaignPerformanceReport } from "@/hooks/useCampaignPerformanceReport";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import {
  downloadCampaignPerformanceCsv,
  downloadCampaignPerformanceExcel,
} from "@/lib/reports/campaign-performance-export";
import { dateRangeFromDays, normalizeDateRange } from "@/lib/metrics-date-range";
import type { CampaignStatus } from "@/types";

function formatPercent(value: number): string {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

export default function CampaignPerformanceReportPage() {
  const t = useT();
  const { formatNumber } = useFormatters();
  const { data: bots } = useBots();
  const defaultRange = useMemo(() => dateRangeFromDays(30), []);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [draftBotId, setDraftBotId] = useState("");
  const [applied, setApplied] = useState<{
    from: string;
    to: string;
    botId: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const range = applied ? { from: applied.from, to: applied.to } : null;
  const { data, isLoading, isFetching, error } = useCampaignPerformanceReport(
    range,
    applied?.botId || undefined,
    Boolean(applied)
  );

  const botName =
    applied?.botId && bots
      ? bots.find((bot) => bot.botId === applied.botId)?.name ?? applied.botId
      : t("metrics.filterBotAll");

  const exportLabels = {
    campaignHeaders: [
      t("reports.campaignPerformance.colCampaign"),
      t("reports.campaignPerformance.colTemplate"),
      t("reports.campaignPerformance.colLanguage"),
      t("reports.campaignPerformance.colStatus"),
      t("reports.campaignPerformance.colStarted"),
      t("reports.campaignPerformance.colSent"),
      t("reports.campaignPerformance.colDelivered"),
      t("reports.campaignPerformance.colRead"),
      t("reports.campaignPerformance.colFailed"),
      t("reports.campaignPerformance.colDeliveryFailed"),
      t("reports.campaignPerformance.colReplies"),
      t("reports.campaignPerformance.colDeliveryRate"),
      t("reports.campaignPerformance.colReadRate"),
      t("reports.campaignPerformance.colReplyRate"),
    ],
    templateHeaders: [
      t("reports.campaignPerformance.colTemplate"),
      t("reports.campaignPerformance.colLanguage"),
      t("reports.campaignPerformance.colCampaigns"),
      t("reports.campaignPerformance.colSent"),
      t("reports.campaignPerformance.colDelivered"),
      t("reports.campaignPerformance.colRead"),
      t("reports.campaignPerformance.colFailed"),
      t("reports.campaignPerformance.colDeliveryFailed"),
      t("reports.campaignPerformance.colReplies"),
      t("reports.campaignPerformance.colDeliveryRate"),
      t("reports.campaignPerformance.colReadRate"),
      t("reports.campaignPerformance.colReplyRate"),
    ],
    campaignsSheetName: t("reports.campaignPerformance.campaignsSheetName"),
    templatesSheetName: t("reports.campaignPerformance.templatesSheetName"),
  };

  const canExport =
    Boolean(applied && data && data.campaigns.length > 0) &&
    !isLoading &&
    !isFetching &&
    !error;

  function openFiltersModal() {
    if (applied) {
      setDraftFrom(applied.from);
      setDraftTo(applied.to);
      setDraftBotId(applied.botId);
    } else {
      const next = dateRangeFromDays(30);
      setDraftFrom(next.from);
      setDraftTo(next.to);
      setDraftBotId("");
    }
    setFiltersOpen(true);
  }

  function handleConfirmGenerate() {
    const next = normalizeDateRange(draftFrom, draftTo);
    setDraftFrom(next.from);
    setDraftTo(next.to);
    setApplied({ from: next.from, to: next.to, botId: draftBotId });
    setFiltersOpen(false);
  }

  function handleExportCsv() {
    if (!data) return;
    setIsExporting(true);
    try {
      downloadCampaignPerformanceCsv(data, exportLabels);
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportExcel() {
    if (!data) return;
    setIsExporting(true);
    try {
      downloadCampaignPerformanceExcel(data, exportLabels);
    } finally {
      setIsExporting(false);
    }
  }

  function statusLabel(status: CampaignStatus): string {
    return t(`campaigns.status.${status}`);
  }

  const inputClass =
    "w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

  const totals = data?.totals;
  const campaigns = data?.campaigns ?? [];
  const byTemplate = data?.byTemplate ?? [];
  const hasData = campaigns.length > 0;

  return (
    <DashboardPage>
      <div className="mb-4">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("reports.backToList")}
        </Link>
      </div>

      <PageHeader
        title={t("reports.campaignPerformance.title")}
        subtitle={t("reports.campaignPerformance.description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={openFiltersModal} disabled={isFetching}>
              {isFetching ? t("reports.generating") : t("reports.generate")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canExport || isExporting}
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" />
              {t("reports.exportCsv")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canExport || isExporting}
              onClick={handleExportExcel}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {t("reports.exportExcel")}
            </Button>
          </div>
        }
      />

      {applied ? (
        <p className="mb-4 text-sm text-secondary">
          {t("reports.campaignPerformance.appliedRange", {
            from: applied.from,
            to: applied.to,
            bot: botName,
          })}
        </p>
      ) : null}

      {!applied ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title={t("reports.campaignPerformance.idleTitle")}
          description={t("reports.campaignPerformance.idleDescription")}
          action={<Button onClick={openFiltersModal}>{t("reports.generate")}</Button>}
        />
      ) : error ? (
        <Alert variant="danger">{t("reports.loadError")}</Alert>
      ) : isLoading || !data || !totals ? (
        <p className="text-sm text-secondary">{t("common.loading")}</p>
      ) : !hasData ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title={t("reports.campaignPerformance.noDataTitle")}
          description={t("reports.campaignPerformance.noDataDescription")}
        />
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-primary">
              {t("reports.campaignPerformance.campaignsTitle")}
            </h3>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colCampaign")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colTemplate")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colStatus")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colSent")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colDelivered")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colRead")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colFailed")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colReplies")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.campaignPerformance.colReplyRate")}
                  </DataTableCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {campaigns.map((row) => (
                  <DataTableRow key={row.campaignId}>
                    <DataTableCell>
                      <div className="font-medium text-primary">{row.name}</div>
                      <div className="text-xs text-muted">
                        {(row.startedAt ?? row.createdAt).slice(0, 10)}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{row.templateName}</div>
                      <div className="text-xs text-muted">{row.language}</div>
                    </DataTableCell>
                    <DataTableCell>{statusLabel(row.status)}</DataTableCell>
                    <DataTableCell>{formatNumber(row.sent)}</DataTableCell>
                    <DataTableCell>
                      {formatNumber(row.delivered)}
                      <span className="ml-1 text-xs text-muted">
                        ({formatPercent(row.deliveryRate)})
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      {formatNumber(row.read)}
                      <span className="ml-1 text-xs text-muted">
                        ({formatPercent(row.readRate)})
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      {formatNumber(row.failed + row.deliveryFailed)}
                    </DataTableCell>
                    <DataTableCell>{formatNumber(row.replies)}</DataTableCell>
                    <DataTableCell>{formatPercent(row.replyRate)}</DataTableCell>
                  </DataTableRow>
                ))}
                <DataTableRow className="border-t border-default font-semibold text-primary">
                  <DataTableCell>{t("common.total")}</DataTableCell>
                  <DataTableCell>
                    {t("reports.campaignPerformance.kpiSentHint", {
                      count: formatNumber(totals.campaigns),
                    })}
                  </DataTableCell>
                  <DataTableCell>—</DataTableCell>
                  <DataTableCell>{formatNumber(totals.sent)}</DataTableCell>
                  <DataTableCell>
                    {formatNumber(totals.delivered)}
                    <span className="ml-1 text-xs font-normal text-muted">
                      ({formatPercent(totals.deliveryRate)})
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    {formatNumber(totals.read)}
                    <span className="ml-1 text-xs font-normal text-muted">
                      ({formatPercent(totals.readRate)})
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    {formatNumber(totals.failed + totals.deliveryFailed)}
                  </DataTableCell>
                  <DataTableCell>{formatNumber(totals.replies)}</DataTableCell>
                  <DataTableCell>{formatPercent(totals.replyRate)}</DataTableCell>
                </DataTableRow>
              </DataTableBody>
            </DataTable>
          </div>

          {byTemplate.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-primary">
                {t("reports.campaignPerformance.templatesTitle")}
              </h3>
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableCell header>
                      {t("reports.campaignPerformance.colTemplate")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.campaignPerformance.colCampaigns")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.campaignPerformance.colSent")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.campaignPerformance.colDelivered")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.campaignPerformance.colRead")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.campaignPerformance.colReplies")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.campaignPerformance.colReplyRate")}
                    </DataTableCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {byTemplate.map((row) => (
                    <DataTableRow key={`${row.templateName}:${row.language}`}>
                      <DataTableCell>
                        <div className="font-medium text-primary">
                          {row.templateName}
                        </div>
                        <div className="text-xs text-muted">{row.language}</div>
                      </DataTableCell>
                      <DataTableCell>{formatNumber(row.campaigns)}</DataTableCell>
                      <DataTableCell>{formatNumber(row.sent)}</DataTableCell>
                      <DataTableCell>
                        {formatNumber(row.delivered)}
                        <span className="ml-1 text-xs text-muted">
                          ({formatPercent(row.deliveryRate)})
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        {formatNumber(row.read)}
                        <span className="ml-1 text-xs text-muted">
                          ({formatPercent(row.readRate)})
                        </span>
                      </DataTableCell>
                      <DataTableCell>{formatNumber(row.replies)}</DataTableCell>
                      <DataTableCell>{formatPercent(row.replyRate)}</DataTableCell>
                    </DataTableRow>
                  ))}
                  <DataTableRow className="border-t border-default font-semibold text-primary">
                    <DataTableCell>{t("common.total")}</DataTableCell>
                    <DataTableCell>{formatNumber(totals.campaigns)}</DataTableCell>
                    <DataTableCell>{formatNumber(totals.sent)}</DataTableCell>
                    <DataTableCell>
                      {formatNumber(totals.delivered)}
                      <span className="ml-1 text-xs font-normal text-muted">
                        ({formatPercent(totals.deliveryRate)})
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      {formatNumber(totals.read)}
                      <span className="ml-1 text-xs font-normal text-muted">
                        ({formatPercent(totals.readRate)})
                      </span>
                    </DataTableCell>
                    <DataTableCell>{formatNumber(totals.replies)}</DataTableCell>
                    <DataTableCell>{formatPercent(totals.replyRate)}</DataTableCell>
                  </DataTableRow>
                </DataTableBody>
              </DataTable>
            </div>
          ) : null}
        </div>
      )}

      {filtersOpen ? (
        <Modal className="p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-default bg-surface-elevated shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-performance-filters-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
              <div>
                <h2
                  id="campaign-performance-filters-title"
                  className="text-base font-semibold text-primary"
                >
                  {t("reports.campaignPerformance.modalTitle")}
                </h2>
                <p className="mt-1 text-sm text-secondary">
                  {t("reports.campaignPerformance.modalDescription")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
                aria-label={t("common.cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-secondary">
                  {t("metrics.filterDateFrom")}
                </label>
                <input
                  type="date"
                  value={draftFrom}
                  max={draftTo}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-secondary">
                  {t("metrics.filterDateTo")}
                </label>
                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-secondary">
                  {t("metrics.filterBot")}
                </label>
                <select
                  value={draftBotId}
                  onChange={(e) => setDraftBotId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("metrics.filterBotAll")}</option>
                  {bots?.map((bot) => (
                    <option key={bot.botId} value={bot.botId}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-default px-5 py-4">
              <Button variant="secondary" onClick={() => setFiltersOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleConfirmGenerate}>{t("reports.generate")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </DashboardPage>
  );
}
