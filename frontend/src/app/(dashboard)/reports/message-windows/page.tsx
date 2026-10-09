"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, X } from "lucide-react";
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
import { StatCard } from "@/components/ui/StatCard";
import { useBots } from "@/hooks/useBots";
import { useMessageWindowExport } from "@/hooks/useMessageWindowExport";
import { useMessageWindowReport } from "@/hooks/useMessageWindowReport";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { dateRangeFromDays, normalizeDateRange } from "@/lib/metrics-date-range";

export default function MessageWindowReportPage() {
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

  const range = applied ? { from: applied.from, to: applied.to } : null;
  const { data, isLoading, isFetching, error } = useMessageWindowReport(
    range,
    applied?.botId || undefined,
    Boolean(applied)
  );
  const { exportCsv, exportExcel, isExporting } = useMessageWindowExport();

  const exportLabels = {
    headers: [
      t("reports.messageWindows.colDate"),
      t("reports.messageWindows.colInboundService24h"),
      t("reports.messageWindows.colOutboundService24h"),
      t("reports.messageWindows.colInboundFreeEntry72h"),
      t("reports.messageWindows.colOutboundFreeEntry72h"),
      t("reports.messageWindows.colInboundOutside"),
      t("reports.messageWindows.colOutboundOutside"),
      t("reports.messageWindows.colTotal"),
    ],
    sheetName: t("reports.messageWindows.sheetName"),
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
  const totals = data?.totals ?? {
    inboundService24h: 0,
    outboundService24h: 0,
    inboundFreeEntry72h: 0,
    outboundFreeEntry72h: 0,
    inboundOutsideWindow: 0,
    outboundOutsideWindow: 0,
    total: 0,
  };
  const hasData = daily.some(
    (row) =>
      row.inboundService24h > 0 ||
      row.outboundService24h > 0 ||
      row.inboundFreeEntry72h > 0 ||
      row.outboundFreeEntry72h > 0 ||
      row.inboundOutsideWindow > 0 ||
      row.outboundOutsideWindow > 0
  );
  const canExport = Boolean(data?.daily) && !isLoading && !isFetching && !error;
  const appliedBotName = applied?.botId
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
        title={t("reports.messageWindows.title")}
        subtitle={t("reports.messageWindows.description")}
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
          {t("reports.messageWindows.appliedRange", {
            from: applied.from,
            to: applied.to,
            bot: appliedBotName,
          })}
        </p>
      ) : null}

      {!applied ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title={t("reports.messageWindows.idleTitle")}
          description={t("reports.messageWindows.idleDescription")}
          action={<Button onClick={openFiltersModal}>{t("reports.generate")}</Button>}
        />
      ) : error ? (
        <Alert variant="danger">{t("reports.loadError")}</Alert>
      ) : isLoading ? (
        <p className="text-sm text-secondary">{t("common.loading")}</p>
      ) : data?.daily ? (
        !hasData ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={t("reports.messageWindows.noDataTitle")}
            description={t("reports.messageWindows.noDataDescription")}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                compact
                label={t("reports.messageWindows.kpiService24h")}
                value={formatNumber(totals.inboundService24h + totals.outboundService24h)}
                sub={t("reports.messageWindows.directionSplit", {
                  inbound: formatNumber(totals.inboundService24h),
                  outbound: formatNumber(totals.outboundService24h),
                })}
              />
              <StatCard
                compact
                label={t("reports.messageWindows.kpiFreeEntry72h")}
                value={formatNumber(totals.inboundFreeEntry72h + totals.outboundFreeEntry72h)}
                sub={t("reports.messageWindows.directionSplit", {
                  inbound: formatNumber(totals.inboundFreeEntry72h),
                  outbound: formatNumber(totals.outboundFreeEntry72h),
                })}
              />
              <StatCard
                compact
                label={t("reports.messageWindows.kpiOutside")}
                value={formatNumber(totals.inboundOutsideWindow + totals.outboundOutsideWindow)}
                sub={t("reports.messageWindows.directionSplit", {
                  inbound: formatNumber(totals.inboundOutsideWindow),
                  outbound: formatNumber(totals.outboundOutsideWindow),
                })}
              />
            </div>
            <DataTable minWidth="1080px">
              <DataTableHead>
                <DataTableRow>
                  <DataTableCell header>{t("reports.messageWindows.colDate")}</DataTableCell>
                  <DataTableCell header>
                    {t("reports.messageWindows.colInboundService24h")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.messageWindows.colOutboundService24h")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.messageWindows.colInboundFreeEntry72h")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.messageWindows.colOutboundFreeEntry72h")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.messageWindows.colInboundOutside")}
                  </DataTableCell>
                  <DataTableCell header>
                    {t("reports.messageWindows.colOutboundOutside")}
                  </DataTableCell>
                  <DataTableCell header>{t("reports.messageWindows.colTotal")}</DataTableCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {daily.map((row) => (
                  <DataTableRow key={row.date}>
                    <DataTableCell>{row.date}</DataTableCell>
                    <DataTableCell>{formatNumber(row.inboundService24h)}</DataTableCell>
                    <DataTableCell>{formatNumber(row.outboundService24h)}</DataTableCell>
                    <DataTableCell>{formatNumber(row.inboundFreeEntry72h)}</DataTableCell>
                    <DataTableCell>{formatNumber(row.outboundFreeEntry72h)}</DataTableCell>
                    <DataTableCell>{formatNumber(row.inboundOutsideWindow)}</DataTableCell>
                    <DataTableCell>{formatNumber(row.outboundOutsideWindow)}</DataTableCell>
                    <DataTableCell>{formatNumber(row.total)}</DataTableCell>
                  </DataTableRow>
                ))}
                <DataTableRow className="border-t border-default font-semibold text-primary">
                  <DataTableCell>{t("common.total")}</DataTableCell>
                  <DataTableCell>{formatNumber(totals.inboundService24h)}</DataTableCell>
                  <DataTableCell>{formatNumber(totals.outboundService24h)}</DataTableCell>
                  <DataTableCell>{formatNumber(totals.inboundFreeEntry72h)}</DataTableCell>
                  <DataTableCell>{formatNumber(totals.outboundFreeEntry72h)}</DataTableCell>
                  <DataTableCell>{formatNumber(totals.inboundOutsideWindow)}</DataTableCell>
                  <DataTableCell>{formatNumber(totals.outboundOutsideWindow)}</DataTableCell>
                  <DataTableCell>{formatNumber(totals.total)}</DataTableCell>
                </DataTableRow>
              </DataTableBody>
            </DataTable>
          </div>
        )
      ) : null}

      {filtersOpen ? (
        <Modal className="p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-default bg-surface-elevated shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-windows-filters-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
              <div>
                <h2
                  id="message-windows-filters-title"
                  className="text-base font-semibold text-primary"
                >
                  {t("reports.messageWindows.modalTitle")}
                </h2>
                <p className="mt-1 text-sm text-secondary">
                  {t("reports.messageWindows.modalDescription")}
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
