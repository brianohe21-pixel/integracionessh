"use client";

import { useState } from "react";
import {
  downloadWhatsAppUsageCsv,
  downloadWhatsAppUsageExcel,
  type WhatsAppUsageExportLabels,
} from "@/lib/reports/whatsapp-usage-export";
import type { WhatsAppUsageReport } from "@/types";

export function useWhatsAppUsageExport() {
  const [isExporting, setIsExporting] = useState(false);

  async function runExport(
    kind: "csv" | "excel",
    report: WhatsAppUsageReport,
    labels: WhatsAppUsageExportLabels
  ) {
    setIsExporting(true);
    try {
      if (kind === "csv") downloadWhatsAppUsageCsv(report, labels);
      else downloadWhatsAppUsageExcel(report, labels);
    } finally {
      setIsExporting(false);
    }
  }

  return {
    isExporting,
    exportCsv: (report: WhatsAppUsageReport, labels: WhatsAppUsageExportLabels) =>
      runExport("csv", report, labels),
    exportExcel: (report: WhatsAppUsageReport, labels: WhatsAppUsageExportLabels) =>
      runExport("excel", report, labels),
  };
}
