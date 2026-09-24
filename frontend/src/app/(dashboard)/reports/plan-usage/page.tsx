"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
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
import { usePlanUsageReport } from "@/hooks/usePlanUsageReport";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import {
  downloadPlanUsageCsv,
  downloadPlanUsageExcel,
} from "@/lib/reports/plan-usage-export";
import { dateRangeFromDays, normalizeDateRange } from "@/lib/metrics-date-range";

function formatLimit(value: number, unlimitedLabel: string): string {
  if (value >= 1_000_000) return unlimitedLabel;
  return value.toLocaleString();
}

function percentUsed(used: number, limit: number): number {
  if (limit <= 0 || limit >= 1_000_000) return 0;
  return Math.round((used / limit) * 1000) / 10;
}

export default function PlanUsageReportPage() {
  const t = useT();
  const { formatNumber, planLabel } = useFormatters();
  const defaultRange = useMemo(() => dateRangeFromDays(90), []);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const range = applied ? { from: applied.from, to: applied.to } : null;
  const { data, isLoading, isFetching, error } = usePlanUsageReport(
    range,
    Boolean(applied)
  );

  const unlimitedLabel = t("billing.unlimited");
  const monthlyBulkLimit = (data?.limits.maxMessagesPerMonth ?? 0) * 10;
  const voicebotLimit =
    (data?.limits as { maxVoicebotMinutesPerMonth?: number } | undefined)
      ?.maxVoicebotMinutesPerMonth ?? 0;
  const usage = data?.usage;
  const periods = data?.periods ?? [];

  const exportLabels = {
    headers: [
      t("reports.planUsage.colPeriod"),
      t("billing.usageMessages"),
      t("billing.usageBulk"),
      t("billing.usageCampaigns"),
      t("reports.planUsage.usageVoicebot"),
    ],
    sheetName: t("reports.planUsage.sheetName"),
    filenamePrefix: "plan-usage",
  };

  const canExport =
    Boolean(applied && data && periods.length > 0) &&
    !isLoading &&
    !isFetching &&
    !error;

  function openFiltersModal() {
    if (applied) {
      setDraftFrom(applied.from);
      setDraftTo(applied.to);
    } else {
      const next = dateRangeFromDays(90);
      setDraftFrom(next.from);
      setDraftTo(next.to);
    }
    setFiltersOpen(true);
  }

  function handleConfirmGenerate() {
    const next = normalizeDateRange(draftFrom, draftTo);
    setDraftFrom(next.from);
    setDraftTo(next.to);
    setApplied({ from: next.from, to: next.to });
    setFiltersOpen(false);
  }

  function handleExportCsv() {
    if (!applied || periods.length === 0) return;
    setIsExporting(true);
    try {
      downloadPlanUsageCsv(applied.from, applied.to, periods, exportLabels);
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportExcel() {
    if (!applied || periods.length === 0) return;
    setIsExporting(true);
    try {
      downloadPlanUsageExcel(applied.from, applied.to, periods, exportLabels);
    } finally {
      setIsExporting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

  const hasActivity = periods.some(
    (period) =>
      (period.messagesCount ?? 0) > 0 ||
      (period.bulkRecipientsCount ?? 0) > 0 ||
      (period.campaignsStarted ?? 0) > 0 ||
      (period.voicebotMinutesCount ?? 0) > 0
  );

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
        title={t("reports.planUsage.title")}
        subtitle={t("reports.planUsage.description")}
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
          {t("reports.planUsage.appliedRange", {
            from: applied.from,
            to: applied.to,
          })}
        </p>
      ) : null}

      {!applied ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title={t("reports.planUsage.idleTitle")}
          description={t("reports.planUsage.idleDescription")}
          action={<Button onClick={openFiltersModal}>{t("reports.generate")}</Button>}
        />
      ) : error ? (
        <Alert variant="danger">{t("reports.loadError")}</Alert>
      ) : isLoading || !data || !usage ? (
        <p className="text-sm text-secondary">{t("common.loading")}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{planLabel(data.plan)}</Badge>
            {data.subscription && data.subscription !== "none" ? (
              <span className="text-sm text-muted">
                {t(`billing.subscriptionStatus.${data.subscription}`)}
              </span>
            ) : null}
          </div>

          <Alert variant="info">{t("reports.planUsage.note")}</Alert>

          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableCell header>{t("reports.planUsage.colMetric")}</DataTableCell>
                <DataTableCell header>{t("reports.planUsage.colUsed")}</DataTableCell>
                <DataTableCell header>{t("reports.planUsage.colLimit")}</DataTableCell>
                <DataTableCell header>{t("reports.planUsage.colPercent")}</DataTableCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              <DataTableRow>
                <DataTableCell>{t("billing.usageMessages")}</DataTableCell>
                <DataTableCell>{formatNumber(usage.messagesCount ?? 0)}</DataTableCell>
                <DataTableCell>
                  {formatLimit(data.limits.maxMessagesPerMonth, unlimitedLabel)}
                </DataTableCell>
                <DataTableCell>
                  {t("reports.planUsage.percentUsed", {
                    percent: percentUsed(
                      usage.messagesCount ?? 0,
                      data.limits.maxMessagesPerMonth
                    ),
                  })}
                </DataTableCell>
              </DataTableRow>
              <DataTableRow>
                <DataTableCell>{t("billing.usageBulk")}</DataTableCell>
                <DataTableCell>
                  {formatNumber(usage.bulkRecipientsCount ?? 0)}
                </DataTableCell>
                <DataTableCell>
                  {formatLimit(monthlyBulkLimit, unlimitedLabel)}
                </DataTableCell>
                <DataTableCell>
                  {t("reports.planUsage.percentUsed", {
                    percent: percentUsed(
                      usage.bulkRecipientsCount ?? 0,
                      monthlyBulkLimit
                    ),
                  })}
                </DataTableCell>
              </DataTableRow>
              <DataTableRow>
                <DataTableCell>{t("billing.usageCampaigns")}</DataTableCell>
                <DataTableCell>
                  {formatNumber(usage.campaignsStarted ?? 0)}
                </DataTableCell>
                <DataTableCell>
                  {formatLimit(data.limits.maxActiveCampaigns, unlimitedLabel)}
                </DataTableCell>
                <DataTableCell>
                  {t("reports.planUsage.percentUsed", {
                    percent: percentUsed(
                      usage.campaignsStarted ?? 0,
                      data.limits.maxActiveCampaigns
                    ),
                  })}
                </DataTableCell>
              </DataTableRow>
              {(voicebotLimit > 0 || (usage.voicebotMinutesCount ?? 0) > 0) ? (
                <DataTableRow>
                  <DataTableCell>{t("reports.planUsage.usageVoicebot")}</DataTableCell>
                  <DataTableCell>
                    {formatNumber(usage.voicebotMinutesCount ?? 0)}
                  </DataTableCell>
                  <DataTableCell>
                    {formatLimit(voicebotLimit, unlimitedLabel)}
                  </DataTableCell>
                  <DataTableCell>
                    {t("reports.planUsage.percentUsed", {
                      percent: percentUsed(
                        usage.voicebotMinutesCount ?? 0,
                        voicebotLimit
                      ),
                    })}
                  </DataTableCell>
                </DataTableRow>
              ) : null}
            </DataTableBody>
          </DataTable>

          {!hasActivity ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title={t("reports.planUsage.noDataTitle")}
              description={t("reports.planUsage.noDataDescription")}
            />
          ) : (
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableCell header>{t("reports.planUsage.colPeriod")}</DataTableCell>
                  <DataTableCell header>{t("billing.usageMessages")}</DataTableCell>
                  <DataTableCell header>{t("billing.usageBulk")}</DataTableCell>
                  <DataTableCell header>{t("billing.usageCampaigns")}</DataTableCell>
                  <DataTableCell header>{t("reports.planUsage.usageVoicebot")}</DataTableCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {periods.map((period) => (
                  <DataTableRow key={period.period}>
                    <DataTableCell>
                      <span className="font-medium text-primary">{period.period}</span>
                    </DataTableCell>
                    <DataTableCell>{formatNumber(period.messagesCount ?? 0)}</DataTableCell>
                    <DataTableCell>
                      {formatNumber(period.bulkRecipientsCount ?? 0)}
                    </DataTableCell>
                    <DataTableCell>
                      {formatNumber(period.campaignsStarted ?? 0)}
                    </DataTableCell>
                    <DataTableCell>
                      {formatNumber(period.voicebotMinutesCount ?? 0)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
                <DataTableRow className="border-t border-default font-semibold text-primary">
                  <DataTableCell>{t("common.total")}</DataTableCell>
                  <DataTableCell>{formatNumber(usage.messagesCount ?? 0)}</DataTableCell>
                  <DataTableCell>
                    {formatNumber(usage.bulkRecipientsCount ?? 0)}
                  </DataTableCell>
                  <DataTableCell>
                    {formatNumber(usage.campaignsStarted ?? 0)}
                  </DataTableCell>
                  <DataTableCell>
                    {formatNumber(usage.voicebotMinutesCount ?? 0)}
                  </DataTableCell>
                </DataTableRow>
              </DataTableBody>
            </DataTable>
          )}
        </div>
      )}

      {filtersOpen ? (
        <Modal className="p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-default bg-surface-elevated shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-usage-filters-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
              <div>
                <h2
                  id="plan-usage-filters-title"
                  className="text-base font-semibold text-primary"
                >
                  {t("reports.planUsage.modalTitle")}
                </h2>
                <p className="mt-1 text-sm text-secondary">
                  {t("reports.planUsage.modalDescription")}
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
              <p className="text-xs text-muted">{t("reports.planUsage.modalPeriodHint")}</p>
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
