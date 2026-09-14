"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import {
  downloadFlowActivityCsv,
  downloadFlowActivityExcel,
  type FlowActivityExportFilters,
  type FlowActivityExportLabels,
} from "@/lib/flow-activity-export";
import type { FlowActivitySummary } from "@/types";

export function useFlowActivityExport(flowId: string, filters: FlowActivityExportFilters) {
  const t = useT();
  const { formatDate } = useFormatters();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const labels = useMemo<FlowActivityExportLabels>(
    () => ({
      headers: [
        t("flows.activity.colWhen"),
        t("flows.activity.colSource"),
        t("common.status"),
        t("flows.activity.colContact"),
        t("flows.activity.colSteps"),
        t("flows.activity.colWebhook"),
        t("flows.activity.colPayload"),
        t("flows.activity.colRunId"),
        t("flows.activity.colSubmissionId"),
        t("flows.activity.colConversation"),
        t("flows.activity.colIdempotencyKey"),
        t("flows.activity.colActivityId"),
      ],
      formatSource: (source: FlowActivitySummary["source"]) =>
        t(`flows.activity.source.${source ?? "conversation"}`),
      formatStatus: (status: FlowActivitySummary["status"]) =>
        t(`flows.activity.status.${status}`),
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
          ? await downloadFlowActivityCsv(flowId, filters, labels)
          : await downloadFlowActivityExcel(flowId, filters, labels);
      if (count === 0) {
        setExportError(t("flows.activity.exportEmpty"));
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("flows.activity.exportFailed"));
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
