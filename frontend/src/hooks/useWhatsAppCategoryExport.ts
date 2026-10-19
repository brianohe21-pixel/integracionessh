"use client";

import { useState } from "react";
import {
  downloadWhatsAppCategoryCsv,
  downloadWhatsAppCategoryExcel,
  type WhatsAppCategoryExportLabels,
} from "@/lib/reports/whatsapp-category-export";
import type { WhatsAppCategoryReport } from "@/types";

export function useWhatsAppCategoryExport() {
  const [isExporting, setIsExporting] = useState(false);

  async function runExport(
    kind: "csv" | "excel",
    report: WhatsAppCategoryReport,
    labels: WhatsAppCategoryExportLabels
  ) {
    setIsExporting(true);
    try {
      if (kind === "csv") downloadWhatsAppCategoryCsv(report, labels);
      else downloadWhatsAppCategoryExcel(report, labels);
    } finally {
      setIsExporting(false);
    }
  }

  return {
    isExporting,
    exportCsv: (report: WhatsAppCategoryReport, labels: WhatsAppCategoryExportLabels) =>
      runExport("csv", report, labels),
    exportExcel: (report: WhatsAppCategoryReport, labels: WhatsAppCategoryExportLabels) =>
      runExport("excel", report, labels),
  };
}
