"use client";

import { useState } from "react";
import {
  downloadConversationsByClientCsv,
  downloadConversationsByClientExcel,
  type ConversationsByClientExportLabels,
} from "@/lib/reports/conversations-by-client-export";
import type { ConversationsByClientReport } from "@/types";

export function useConversationsByClientExport() {
  const [isExporting, setIsExporting] = useState(false);

  async function runExport(
    kind: "csv" | "excel",
    report: ConversationsByClientReport,
    labels: ConversationsByClientExportLabels
  ) {
    setIsExporting(true);
    try {
      if (kind === "csv") downloadConversationsByClientCsv(report, labels);
      else downloadConversationsByClientExcel(report, labels);
    } finally {
      setIsExporting(false);
    }
  }

  return {
    isExporting,
    exportCsv: (report: ConversationsByClientReport, labels: ConversationsByClientExportLabels) =>
      runExport("csv", report, labels),
    exportExcel: (
      report: ConversationsByClientReport,
      labels: ConversationsByClientExportLabels
    ) => runExport("excel", report, labels),
  };
}
