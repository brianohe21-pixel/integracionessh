"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, History } from "lucide-react";
import { useSmsHistory, type SmsHistoryFilters } from "@/hooks/useSms";
import { useSmsHistoryExport } from "@/hooks/useSmsHistoryExport";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { TableContainer } from "@/components/ui/TableContainer";
import type { SmsHistoryItem, SmsHistoryStatus } from "@/types";

const PAGE_SIZE = 20;

function statusVariant(
  status: SmsHistoryStatus
): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "delivered") return "success";
  if (status === "delivery_failed" || status === "send_failed") return "danger";
  if (status === "sent") return "info";
  return "warning";
}

export function SmsHistoryTab() {
  const t = useT();
  const { formatDate } = useFormatters();
  const [source, setSource] = useState<SmsHistoryFilters["source"]>("all");
  const [status, setStatus] = useState<SmsHistoryFilters["status"]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
  }, [source, status, from, to]);

  const filters: SmsHistoryFilters = {
    limit: PAGE_SIZE,
    cursor: cursorStack[pageIndex],
    source,
    status,
    ...(from ? { from: new Date(from).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
  };

  const exportFilters: SmsHistoryFilters = {
    source,
    status,
    ...(from ? { from: new Date(from).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
  };

  const { data, isLoading, isFetching } = useSmsHistory(filters);
  const { exportCsv, exportExcel, isExporting, exportError } = useSmsHistoryExport(exportFilters);
  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor;
  const canGoPrev = pageIndex > 0;
  const canGoNext = Boolean(nextCursor);

  function goNextPage() {
    if (!nextCursor) return;
    setCursorStack((current) => {
      const next = [...current];
      next[pageIndex + 1] = nextCursor;
      return next.slice(0, pageIndex + 2);
    });
    setPageIndex((current) => current + 1);
  }

  function goPrevPage() {
    if (pageIndex <= 0) return;
    setPageIndex((current) => current - 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div className="space-y-4 border-b border-default bg-surface-elevated px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-primary">{t("smsDashboard.history.title")}</h2>
          <p className="mt-1 text-xs text-secondary">{t("smsDashboard.history.subtitle")}</p>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs text-secondary">{t("smsDashboard.history.filterFrom")}</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-secondary">{t("smsDashboard.history.filterTo")}</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as SmsHistoryFilters["source"])}
              className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">{t("smsDashboard.history.filterSourceAll")}</option>
              <option value="api">{t("smsDashboard.history.source.api")}</option>
              <option value="campaign">{t("smsDashboard.history.source.campaign")}</option>
              <option value="template">{t("smsDashboard.history.source.template")}</option>
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as SmsHistoryFilters["status"])}
              className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">{t("smsDashboard.history.filterStatusAll")}</option>
              <option value="pending">{t("smsDashboard.history.status.pending")}</option>
              <option value="sent">{t("smsDashboard.history.status.sent")}</option>
              <option value="delivered">{t("smsDashboard.history.status.delivered")}</option>
              <option value="delivery_failed">{t("smsDashboard.history.status.delivery_failed")}</option>
              <option value="send_failed">{t("smsDashboard.history.status.send_failed")}</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={isExporting || isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isExporting ? t("smsDashboard.history.exporting") : t("smsDashboard.history.exportCsv")}
            </button>
            <button
              type="button"
              onClick={() => void exportExcel()}
              disabled={isExporting || isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {isExporting ? t("smsDashboard.history.exporting") : t("smsDashboard.history.exportExcel")}
            </button>
          </div>
        </div>

        {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}
      </div>

      {isLoading ? (
        <div className="p-4">
          <SkeletonTable rows={8} cols={6} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title={t("smsDashboard.history.empty")}
          description={t("smsDashboard.history.emptyHint")}
        />
      ) : (
        <TableContainer className="flex-1">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-default text-left text-xs uppercase tracking-wide text-secondary">
                <th className="px-4 py-3">{t("smsDashboard.history.colCreatedAt")}</th>
                <th className="px-4 py-3">{t("smsDashboard.history.colTo")}</th>
                <th className="px-4 py-3">{t("smsDashboard.history.colSource")}</th>
                <th className="px-4 py-3">{t("common.status")}</th>
                <th className="px-4 py-3">{t("smsDashboard.history.colTemplate")}</th>
                <th className="px-4 py-3">{t("smsDashboard.history.colMessageId")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: SmsHistoryItem) => (
                <tr key={item.receiptId} className="border-b border-default/70">
                  <td className="px-4 py-3 text-primary">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3 text-primary">{item.to}</td>
                  <td className="px-4 py-3 text-secondary">
                    {t(`smsDashboard.history.source.${item.source}`)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(item.status)} dot>
                      {t(`smsDashboard.history.status.${item.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-secondary">{item.templateName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-secondary">
                    {item.telcoredMessageId ?? item.receiptId.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      {!isLoading && items.length > 0 ? (
        <div className="flex items-center justify-between border-t border-default bg-surface-elevated px-4 py-3">
          <p className="text-xs text-secondary">
            {isFetching ? t("common.loading") : t("smsDashboard.history.pageInfo", { page: pageIndex + 1 })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevPage}
              disabled={!canGoPrev}
              className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("smsDashboard.history.prev")}
            </button>
            <button
              type="button"
              onClick={goNextPage}
              disabled={!canGoNext}
              className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {t("smsDashboard.history.next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
