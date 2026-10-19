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
import { useAiResponsesExport } from "@/hooks/useAiResponsesExport";
import { useAiResponsesReport } from "@/hooks/useAiResponsesReport";
import { useBots } from "@/hooks/useBots";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { dateRangeFromDays, normalizeDateRange } from "@/lib/metrics-date-range";

function formatLimit(value: number, unlimitedLabel: string): string {
  if (value >= 1_000_000) return unlimitedLabel;
  return value.toLocaleString();
}

export default function AiResponsesReportPage() {
  const t = useT();
  const { formatNumber, planLabel } = useFormatters();
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

  const range = applied ? { from: applied.from, to: applied.to } : null;
  const { data, isLoading, isFetching, error } = useAiResponsesReport(
    range,
    applied?.botId || undefined,
    Boolean(applied)
  );
  const { exportCsv, exportExcel, isExporting } = useAiResponsesExport();

  const unlimitedLabel = t("billing.unlimited");
  const exportLabels = {
    dailyHeaders: [
      t("reports.aiResponses.colDate"),
      t("reports.aiResponses.colResponses"),
    ],
    byBotHeaders: [
      t("reports.aiResponses.colBot"),
      t("reports.aiResponses.colBotId"),
      t("reports.aiResponses.colResponses"),
    ],
    periodsHeaders: [
      t("reports.aiResponses.colPeriod"),
      t("reports.aiResponses.colResponses"),
      t("reports.aiResponses.colPlanLimit"),
      t("reports.aiResponses.colEffectiveLimit"),
      t("reports.aiResponses.colPlanUsed"),
      t("reports.aiResponses.colBonusUsed"),
      t("reports.aiResponses.colRemaining"),
      t("reports.aiResponses.colPercent"),
    ],
    dailySheet: t("reports.aiResponses.dailySheet"),
    byBotSheet: t("reports.aiResponses.byBotSheet"),
    periodsSheet: t("reports.aiResponses.periodsSheet"),
  };

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

  const daily = data?.daily ?? [];
  const byBot = data?.byBot ?? [];
  const periods = data?.periods ?? [];
  const quota = data?.quota;
  const hasDaily = daily.some((row) => row.responses > 0);
  const hasByBot = byBot.some((row) => row.responses > 0);
  const hasPeriods = periods.some((row) => row.responses > 0);
  const hasData = hasDaily || hasByBot || hasPeriods || (quota?.totalUsed ?? 0) > 0;
  const canExport = Boolean(data) && !isLoading && !isFetching && !error && hasData;
  const appliedBotName =
    applied?.botId
      ? bots?.find((bot) => bot.botId === applied.botId)?.name ?? applied.botId
      : t("metrics.filterBotAll");

  const inputClass =
    "w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

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
        title={t("reports.aiResponses.title")}
        subtitle={t("reports.aiResponses.description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={openFiltersModal} disabled={isFetching}>
              {isFetching ? t("reports.generating") : t("reports.generate")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canExport || isExporting}
              onClick={() => data && void exportCsv(data, exportLabels)}
            >
              <Download className="h-4 w-4" />
              {t("reports.exportCsv")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canExport || isExporting}
              onClick={() => data && void exportExcel(data, exportLabels)}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {t("reports.exportExcel")}
            </Button>
          </div>
        }
      />

      {applied ? (
        <p className="mb-4 text-sm text-secondary">
          {t("reports.aiResponses.appliedRange", {
            from: applied.from,
            to: applied.to,
            bot: appliedBotName,
          })}
        </p>
      ) : null}

      {!applied ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title={t("reports.aiResponses.idleTitle")}
          description={t("reports.aiResponses.idleDescription")}
          action={
            <Button onClick={openFiltersModal}>{t("reports.generate")}</Button>
          }
        />
      ) : error ? (
        <Alert variant="danger">{t("reports.loadError")}</Alert>
      ) : isLoading ? (
        <p className="text-sm text-secondary">{t("common.loading")}</p>
      ) : data ? (
        !hasData ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={t("reports.aiResponses.noDataTitle")}
            description={t("reports.aiResponses.noDataDescription")}
          />
        ) : (
          <div className="space-y-6">
            {quota ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t("reports.aiResponses.kpiPlan")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {planLabel(data.plan)}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {t("reports.aiResponses.kpiPlanHint", { period: quota.period })}
                  </p>
                </div>
                <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t("reports.aiResponses.kpiUsed")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {formatNumber(quota.totalUsed)}
                    <span className="text-sm font-normal text-muted">
                      {" "}
                      / {formatLimit(quota.effectiveLimit, unlimitedLabel)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {t("reports.aiResponses.percentUsed", {
                      percent: String(quota.percentUsed),
                    })}
                  </p>
                </div>
                <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t("reports.aiResponses.kpiRemaining")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {formatLimit(quota.remaining, unlimitedLabel)}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {t("reports.aiResponses.kpiRemainingHint")}
                  </p>
                </div>
                <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t("reports.aiResponses.kpiRange")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {formatNumber(data.totals.responses)}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {t("reports.aiResponses.kpiRangeHint")}
                  </p>
                </div>
              </div>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">
                {t("reports.aiResponses.dailyTitle")}
              </h3>
              {!hasDaily ? (
                <p className="text-sm text-secondary">
                  {t("reports.aiResponses.dailyEmpty")}
                </p>
              ) : (
                <DataTable>
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableCell header>
                        {t("reports.aiResponses.colDate")}
                      </DataTableCell>
                      <DataTableCell header>
                        {t("reports.aiResponses.colResponses")}
                      </DataTableCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {daily
                      .filter((row) => row.responses > 0)
                      .map((row) => (
                        <DataTableRow key={row.date}>
                          <DataTableCell>{row.date}</DataTableCell>
                          <DataTableCell>{formatNumber(row.responses)}</DataTableCell>
                        </DataTableRow>
                      ))}
                    <DataTableRow className="border-t border-default font-semibold text-primary">
                      <DataTableCell>{t("common.total")}</DataTableCell>
                      <DataTableCell>
                        {formatNumber(data.totals.responses)}
                      </DataTableCell>
                    </DataTableRow>
                  </DataTableBody>
                </DataTable>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">
                {t("reports.aiResponses.byBotTitle")}
              </h3>
              {!hasByBot ? (
                <p className="text-sm text-secondary">
                  {t("reports.aiResponses.byBotEmpty")}
                </p>
              ) : (
                <DataTable>
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableCell header>
                        {t("reports.aiResponses.colBot")}
                      </DataTableCell>
                      <DataTableCell header>
                        {t("reports.aiResponses.colResponses")}
                      </DataTableCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {byBot.map((row) => (
                      <DataTableRow key={row.botId}>
                        <DataTableCell>
                          <span className="font-medium text-primary">{row.botName}</span>
                        </DataTableCell>
                        <DataTableCell>{formatNumber(row.responses)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">
                {t("reports.aiResponses.periodsTitle")}
              </h3>
              <p className="text-xs text-secondary">
                {t("reports.aiResponses.periodsHint")}
              </p>
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableCell header>
                      {t("reports.aiResponses.colPeriod")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.aiResponses.colResponses")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.aiResponses.colPlanUsed")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.aiResponses.colEffectiveLimit")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.aiResponses.colRemaining")}
                    </DataTableCell>
                    <DataTableCell header>
                      {t("reports.aiResponses.colPercent")}
                    </DataTableCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {periods.map((row) => (
                    <DataTableRow key={row.period}>
                      <DataTableCell>{row.period}</DataTableCell>
                      <DataTableCell>{formatNumber(row.responses)}</DataTableCell>
                      <DataTableCell>{formatNumber(row.planUsed)}</DataTableCell>
                      <DataTableCell>
                        {formatLimit(row.effectiveLimit, unlimitedLabel)}
                      </DataTableCell>
                      <DataTableCell>
                        {formatLimit(row.remaining, unlimitedLabel)}
                      </DataTableCell>
                      <DataTableCell>{`${row.percentUsed}%`}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </section>
          </div>
        )
      ) : null}

      {filtersOpen ? (
        <Modal className="p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-default bg-surface-elevated shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-responses-filters-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
              <div>
                <h2
                  id="ai-responses-filters-title"
                  className="text-base font-semibold text-primary"
                >
                  {t("reports.aiResponses.modalTitle")}
                </h2>
                <p className="mt-1 text-sm text-secondary">
                  {t("reports.aiResponses.modalDescription")}
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
