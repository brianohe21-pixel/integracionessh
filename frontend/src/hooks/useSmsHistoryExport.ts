"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import {
  downloadSmsHistoryCsv,
  downloadSmsHistoryExcel,
  type SmsHistoryExportLabels,
} from "@/lib/sms-history-export";
import type { SmsHistoryFilters } from "@/hooks/useSms";
import type { SmsHistoryItem } from "@/types";

export function useSmsHistoryExport(filters: SmsHistoryFilters) {
  const t = useT();
  const { formatDate } = useFormatters();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const labels = useMemo<SmsHistoryExportLabels>(
    () => ({
      headers: [
        t("smsDashboard.history.colCreatedAt"),
        t("smsDashboard.history.colTo"),
        t("smsDashboard.history.colSource"),
        t("common.status"),
        t("smsDashboard.history.colTemplate"),
        t("smsDashboard.history.colCampaign"),
        t("smsDashboard.history.colMessageId"),
        t("smsDashboard.history.colReceiptId"),
        t("smsDashboard.history.colError"),
        t("smsDashboard.history.colDlrAt"),
      ],
      formatSource: (source: SmsHistoryItem["source"]) =>
        t(`smsDashboard.history.source.${source}`),
      formatStatus: (status: SmsHistoryItem["status"]) =>
        t(`smsDashboard.history.status.${status}`),
      formatDate,
    }),
    [t, formatDate]
  );

  async function runExport(kind: "csv" | "excel") {
    setExportError("");
    setIsExporting(true);
    try {
      const count =
        kind === "csv"
          ? await downloadSmsHistoryCsv(filters, labels)
          : await downloadSmsHistoryExcel(filters, labels);
      if (count === 0) {
        setExportError(t("smsDashboard.history.exportEmpty"));
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("smsDashboard.history.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  }

  return {
    exportCsv: () => runExport("csv"),
    exportExcel: () => runExport("excel"),
    isExporting,
    exportError,
  };
}
