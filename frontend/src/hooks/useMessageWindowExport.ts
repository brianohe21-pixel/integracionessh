"use client";

import { useState } from "react";
import {
  downloadMessageWindowCsv,
  downloadMessageWindowExcel,
  type MessageWindowExportLabels,
} from "@/lib/reports/message-window-export";
import type { MessageWindowReport } from "@/types";

export function useMessageWindowExport() {
  const [isExporting, setIsExporting] = useState(false);

  async function runExport(
    kind: "csv" | "excel",
    report: MessageWindowReport,
    labels: MessageWindowExportLabels
  ) {
    setIsExporting(true);
    try {
      if (kind === "csv") downloadMessageWindowCsv(report, labels);
      else downloadMessageWindowExcel(report, labels);
    } finally {
      setIsExporting(false);
    }
  }

  return {
    isExporting,
    exportCsv: (report: MessageWindowReport, labels: MessageWindowExportLabels) =>
      runExport("csv", report, labels),
    exportExcel: (report: MessageWindowReport, labels: MessageWindowExportLabels) =>
      runExport("excel", report, labels),
  };
}
