"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { BulkSendFailure, BulkSendFailureKind, BulkSendFailuresResponse } from "@/hooks/useBulkSend";
import { useT } from "@/i18n/context";
import { TableContainer } from "@/components/ui/TableContainer";

const FAILURE_HEADERS = ["phone", "type", "error_code", "error_title", "error_message", "failed_at", "message_id"];

function failureKindLabel(kind: BulkSendFailureKind): string {
  return kind === "delivery" ? "delivery" : "send";
}

function downloadFailuresCsv(templateName: string, jobId: string, items: BulkSendFailure[]): void {
  const rows = items.map((item) => [
    item.to,
    failureKindLabel(item.kind),
    item.errorCode != null ? String(item.errorCode) : "",
    item.errorTitle ?? "",
    item.errorMessage,
    item.failedAt,
    item.messageId ?? "",
  ]);
  downloadCsvFile(
    `fallos_${templateName}_${jobId.slice(0, 8)}.csv`,
    buildCsv(FAILURE_HEADERS, rows)
  );
}

interface BulkJobFailuresProps {
  jobId: string;
  templateName?: string;
  enabled?: boolean;
  resource?: "bulk" | "campaign";
}

export function BulkJobFailures({
  jobId,
  templateName = "campana",
  enabled = true,
  resource = "bulk",
}: BulkJobFailuresProps) {
  const t = useT();
  const failuresPath =
    resource === "campaign"
      ? `/campaigns/${jobId}/failures`
      : `/bulk-send/${jobId}/failures`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["bulk-failures", resource, jobId],
    queryFn: () => api.get<BulkSendFailuresResponse>(failuresPath),
    enabled,
  });

  function kindLabel(kind: BulkSendFailureKind): string {
    return kind === "delivery" ? t("bulkSend.failureKindDelivery") : t("bulkSend.failureKindSend");
  }

  function kindVariant(kind: BulkSendFailureKind): string {
    return kind === "delivery"
      ? "bg-orange-50 text-orange-700"
      : "bg-red-50 text-red-700";
  }

  if (isLoading) {
    return <p className="text-xs text-muted px-5 py-3">{t("bulkSend.failuresLoading")}</p>;
  }

  if (isError) {
    return <p className="text-xs text-red-600 px-5 py-3">{t("bulkSend.failuresLoadError")}</p>;
  }

  if (!data || data.total === 0) {
    return (
      <p className="text-xs text-muted px-5 py-3">
        {t("bulkSend.failuresEmpty")}
      </p>
    );
  }

  return (
    <div className="px-5 py-4 bg-surface border-t border-subtle space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => downloadFailuresCsv(templateName, jobId, data.items)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent"
        >
          <Download className="w-3.5 h-3.5" />
          {t("bulkSend.downloadCsv")}
        </button>
      </div>

      {data.summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.summary.map((row) => (
            <span
              key={`${row.kind}-${row.errorCode ?? "x"}-${row.errorTitle}`}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${kindVariant(row.kind)}`}
            >
              <span>{kindLabel(row.kind)}</span>
              {row.errorCode != null && <span className="opacity-70">#{row.errorCode}</span>}
              <span>{row.errorTitle}</span>
              <span className="font-semibold">×{row.count}</span>
            </span>
          ))}
        </div>
      )}

      <TableContainer className="max-h-64 overflow-y-auto rounded-lg border border-default bg-surface-elevated">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-subtle bg-surface">
              <th className="text-left text-xs font-medium text-secondary uppercase px-3 py-2">{t("common.phone")}</th>
              <th className="text-left text-xs font-medium text-secondary uppercase px-3 py-2">{t("common.status")}</th>
              <th className="text-left text-xs font-medium text-secondary uppercase px-3 py-2">{t("bulkSend.failureColCode")}</th>
              <th className="text-left text-xs font-medium text-secondary uppercase px-3 py-2">{t("bulkSend.failureColCause")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.items.map((item, i) => (
              <tr key={`${item.to}-${item.failedAt}-${i}`}>
                <td className="px-3 py-2 text-primary font-mono text-xs">{item.to}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${kindVariant(item.kind)}`}>
                    {kindLabel(item.kind)}
                  </span>
                </td>
                <td className="px-3 py-2 text-secondary text-xs">
                  {item.errorCode ?? "—"}
                </td>
                <td className="px-3 py-2 text-secondary text-xs">{item.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableContainer>

      {data.total >= 500 && (
        <p className="text-xs text-muted">{t("bulkSend.failuresLimit")}</p>
      )}
    </div>
  );
}
