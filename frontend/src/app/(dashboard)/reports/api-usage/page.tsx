"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, X } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useApiUsageReport } from "@/hooks/useApiUsageReport";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { dateRangeFromDays, normalizeDateRange } from "@/lib/metrics-date-range";
import {
  downloadApiUsageCsv,
  downloadApiUsageExcel,
  type ApiUsageExportLabels,
} from "@/lib/reports/api-usage-export";
import type { ApiUsageReport, ApiWebhookActivationStatus } from "@/types";

export default function ApiUsageReportPage() {
  const t = useT();
  const { formatNumber } = useFormatters();
  const defaultRange = useMemo(() => dateRangeFromDays(30), []);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const range = applied ? { from: applied.from, to: applied.to } : null;
  const { data, isLoading, isFetching, error } = useApiUsageReport(range, Boolean(applied));

  const exportLabels: ApiUsageExportLabels = {
    totalsTitle: t("reports.apiUsage.totalsTitle"),
    dailyTitle: t("reports.apiUsage.dailyTitle"),
    byKeyTitle: t("reports.apiUsage.byKeyTitle"),
    byEndpointTitle: t("reports.apiUsage.byEndpointTitle"),
    webhooksTitle: t("reports.apiUsage.webhooksTitle"),
    countHeaders: [
      t("reports.apiUsage.colRequests"),
      t("reports.apiUsage.colSuccess"),
      t("reports.apiUsage.colErrors"),
    ],
    dailyHeaders: [
      t("reports.apiUsage.colDate"),
      t("reports.apiUsage.colRequests"),
      t("reports.apiUsage.colSuccess"),
      t("reports.apiUsage.colErrors"),
    ],
    byKeyHeaders: [
      t("reports.apiUsage.colKey"),
      t("reports.apiUsage.colPrefix"),
      t("reports.apiUsage.colRequests"),
      t("reports.apiUsage.colSuccess"),
      t("reports.apiUsage.colErrors"),
    ],
    byEndpointHeaders: [
      t("reports.apiUsage.colEndpoint"),
      t("reports.apiUsage.colMethod"),
      t("reports.apiUsage.colRequests"),
      t("reports.apiUsage.colSuccess"),
      t("reports.apiUsage.colErrors"),
    ],
    webhookHeaders: [
      t("reports.apiUsage.colStatus"),
      t("reports.apiUsage.colUrl"),
      t("reports.apiUsage.colEvents"),
    ],
    active: t("common.active"),
    inactive: t("common.inactive"),
    filenamePrefix: "api-usage",
  };

  const canExport = Boolean(applied && data) && !isLoading && !isFetching && !error;

  function openFiltersModal() {
    if (applied) {
      setDraftFrom(applied.from);
      setDraftTo(applied.to);
    } else {
      const next = dateRangeFromDays(30);
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
    if (!data) return;
    setIsExporting(true);
    try {
      downloadApiUsageCsv(data, exportLabels);
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportExcel() {
    if (!data) return;
    setIsExporting(true);
    try {
      downloadApiUsageExcel(data, exportLabels);
    } finally {
      setIsExporting(false);
    }
  }

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
        title={t("reports.apiUsage.title")}
        subtitle={t("reports.apiUsage.description")}
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
          {t("reports.apiUsage.appliedRange", {
            from: applied.from,
            to: applied.to,
          })}
        </p>
      ) : null}

      {!applied ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title={t("reports.apiUsage.idleTitle")}
          description={t("reports.apiUsage.idleDescription")}
          action={<Button onClick={openFiltersModal}>{t("reports.generate")}</Button>}
        />
      ) : error ? (
        <Alert variant="danger">{t("reports.loadError")}</Alert>
      ) : isLoading || !data ? (
        <p className="text-sm text-secondary">{t("common.loading")}</p>
      ) : (
        <ApiUsageReportBody report={data} formatNumber={formatNumber} />
      )}

      {filtersOpen ? (
        <Modal className="p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-default bg-surface-elevated shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-usage-filters-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
              <div>
                <h2 id="api-usage-filters-title" className="text-base font-semibold text-primary">
                  {t("reports.apiUsage.modalTitle")}
                </h2>
                <p className="mt-1 text-sm text-secondary">
                  {t("reports.apiUsage.modalDescription")}
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

function ApiUsageReportBody({
  report,
  formatNumber,
}: {
  report: ApiUsageReport;
  formatNumber: (value: number) => string;
}) {
  const t = useT();
  const hasUsage = report.totals.requests > 0;

  function webhookStatusLabel(status: ApiWebhookActivationStatus): string {
    return status === "active" ? t("common.active") : t("common.inactive");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="md">
          <p className="text-xs uppercase text-muted">{t("reports.apiUsage.kpiRequests")}</p>
          <p className="mt-1 text-2xl font-semibold text-primary">
            {formatNumber(report.totals.requests)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-muted">{t("reports.apiUsage.kpiSuccess")}</p>
          <p className="mt-1 text-2xl font-semibold text-primary">
            {formatNumber(report.totals.success)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-muted">{t("reports.apiUsage.kpiErrors")}</p>
          <p className="mt-1 text-2xl font-semibold text-primary">
            {formatNumber(report.totals.error)}
          </p>
        </Card>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-primary">
          {t("reports.apiUsage.dailyTitle")}
        </h3>
        {hasUsage ? (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableCell header>{t("reports.apiUsage.colDate")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colRequests")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colSuccess")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colErrors")}</DataTableCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {report.daily.map((row) => (
                <DataTableRow key={row.date}>
                  <DataTableCell>{row.date}</DataTableCell>
                  <DataTableCell>{formatNumber(row.requests)}</DataTableCell>
                  <DataTableCell>{formatNumber(row.success)}</DataTableCell>
                  <DataTableCell>{formatNumber(row.error)}</DataTableCell>
                </DataTableRow>
              ))}
              <DataTableRow className="border-t border-default font-semibold text-primary">
                <DataTableCell>{t("common.total")}</DataTableCell>
                <DataTableCell>{formatNumber(report.totals.requests)}</DataTableCell>
                <DataTableCell>{formatNumber(report.totals.success)}</DataTableCell>
                <DataTableCell>{formatNumber(report.totals.error)}</DataTableCell>
              </DataTableRow>
            </DataTableBody>
          </DataTable>
        ) : (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={t("reports.apiUsage.noUsageTitle")}
            description={t("reports.apiUsage.noUsageDescription")}
          />
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-primary">
          {t("reports.apiUsage.byKeyTitle")}
        </h3>
        {report.byKey.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={t("reports.apiUsage.noKeysTitle")}
            description={t("reports.apiUsage.noKeysDescription")}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableCell header>{t("reports.apiUsage.colKey")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colPrefix")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colRequests")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colSuccess")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colErrors")}</DataTableCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {report.byKey.map((row) => (
                <DataTableRow key={row.keyId}>
                  <DataTableCell>
                    <span className="font-medium text-primary">{row.keyName}</span>
                  </DataTableCell>
                  <DataTableCell>{row.prefix}</DataTableCell>
                  <DataTableCell>{formatNumber(row.requests)}</DataTableCell>
                  <DataTableCell>{formatNumber(row.success)}</DataTableCell>
                  <DataTableCell>{formatNumber(row.error)}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-primary">
          {t("reports.apiUsage.byEndpointTitle")}
        </h3>
        {report.byEndpoint.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={t("reports.apiUsage.noUsageTitle")}
            description={t("reports.apiUsage.noUsageDescription")}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableCell header>{t("reports.apiUsage.colEndpoint")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colMethod")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colRequests")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colSuccess")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colErrors")}</DataTableCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {report.byEndpoint.map((row) => (
                <DataTableRow key={`${row.method}:${row.endpoint}`}>
                  <DataTableCell>{row.endpoint}</DataTableCell>
                  <DataTableCell>{row.method}</DataTableCell>
                  <DataTableCell>{formatNumber(row.requests)}</DataTableCell>
                  <DataTableCell>{formatNumber(row.success)}</DataTableCell>
                  <DataTableCell>{formatNumber(row.error)}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-primary">
          {t("reports.apiUsage.webhooksTitle")}
        </h3>
        {report.webhooks.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={t("reports.apiUsage.noWebhooksTitle")}
            description={t("reports.apiUsage.noWebhooksDescription")}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableCell header>{t("reports.apiUsage.colStatus")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colUrl")}</DataTableCell>
                <DataTableCell header>{t("reports.apiUsage.colEvents")}</DataTableCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {report.webhooks.map((webhook) => (
                <DataTableRow key={webhook.integrationId}>
                  <DataTableCell>
                    <Badge variant={webhook.status === "active" ? "success" : "default"} dot>
                      {webhookStatusLabel(webhook.status)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="break-all">{webhook.url || "—"}</span>
                  </DataTableCell>
                  <DataTableCell>
                    {webhook.events.length > 0 ? webhook.events.join(", ") : "—"}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>
    </div>
  );
}
