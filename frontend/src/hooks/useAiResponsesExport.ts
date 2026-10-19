"use client";

import { useState } from "react";
import {
  downloadAiResponsesCsv,
  downloadAiResponsesExcel,
  type AiResponsesExportLabels,
} from "@/lib/reports/ai-responses-export";
import type { AiResponsesReport } from "@/types";

export function useAiResponsesExport() {
  const [isExporting, setIsExporting] = useState(false);

  async function runExport(
    kind: "csv" | "excel",
    report: AiResponsesReport,
    labels: AiResponsesExportLabels
  ) {
    setIsExporting(true);
    try {
      if (kind === "csv") downloadAiResponsesCsv(report, labels);
      else downloadAiResponsesExcel(report, labels);
    } finally {
      setIsExporting(false);
    }
  }

  return {
    isExporting,
    exportCsv: (report: AiResponsesReport, labels: AiResponsesExportLabels) =>
      runExport("csv", report, labels),
    exportExcel: (report: AiResponsesReport, labels: AiResponsesExportLabels) =>
      runExport("excel", report, labels),
  };
}
