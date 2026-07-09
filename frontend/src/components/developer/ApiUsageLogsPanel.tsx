"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiKeyLogs } from "@/hooks/useApiKeys";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";
import type { ApiKeyUsageSummary } from "@/types";
import type { MetricsDateRange } from "@/lib/metrics-date-range";

type ApiUsageLogsPanelProps = {
  keys: ApiKeyUsageSummary[];
  selectedKeyId: string | null;
  onSelectKey: (keyId: string | null) => void;
  dateRange: MetricsDateRange;
};

function statusVariant(statusCode: number): "success" | "warning" | "danger" | "default" {
  if (statusCode < 400) return "success";
  if (statusCode < 500) return "warning";
  return "danger";
}

export function ApiUsageLogsPanel({
  keys,
  selectedKeyId,
  onSelectKey,
  dateRange,
}: ApiUsageLogsPanelProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useApiKeyLogs(selectedKeyId, { errorsOnly, range: dateRange });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t("developer.logsTitle")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t("developer.logsSubtitle")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={errorsOnly}
              onChange={(e) => {
                setErrorsOnly(e.target.checked);
                setExpandedLogId(null);
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            {t("developer.logsErrorsOnly")}
          </label>
        </div>

        <select
          value={selectedKeyId ?? ""}
          onChange={(e) => {
            onSelectKey(e.target.value || null);
            setExpandedLogId(null);
          }}
          className="w-full sm:max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{t("developer.logsSelectKey")}</option>
          {keys.map((key) => (
            <option key={key.keyId} value={key.keyId}>
              {key.keyName} ({key.prefix}…)
            </option>
          ))}
        </select>
      </div>

      {!selectedKeyId && (
        <p className="text-sm text-gray-400 text-center py-10">{t("developer.logsPickKey")}</p>
      )}

      {selectedKeyId && isLoading && (
        <div className="p-6 space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {selectedKeyId && !isLoading && logs.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">
          {errorsOnly ? t("developer.logsNoErrors") : t("developer.logsEmpty")}
        </p>
      )}

      {selectedKeyId && !isLoading && logs.length > 0 && (
        <TableContainer>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3">{t("developer.logsColTime")}</th>
                <th className="px-4 py-3">{t("developer.logsColEndpoint")}</th>
                <th className="px-4 py-3">{t("common.status")}</th>
                <th className="px-4 py-3 text-right">{t("developer.logsColDuration")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const hasDetails = Boolean(log.errorMessage || log.errorStack);
                const isExpanded = expandedLogId === log.logId;
                return (
                  <Fragment key={log.logId}>
                    <tr className="align-top">
                      <td className="px-4 py-3">
                        {hasDetails ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLogId(isExpanded ? null : log.logId)
                            }
                            className="text-gray-400 hover:text-gray-600"
                            aria-label={t("developer.logsToggleTrace")}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-gray-800">{log.method}</div>
                        <div className="font-mono text-xs text-gray-500">{log.endpoint}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(log.statusCode)}>{log.statusCode}</Badge>
                        {log.errorMessage && !isExpanded && (
                          <p className="text-xs text-red-600 mt-1 line-clamp-2">{log.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.durationMs} ms</td>
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-6 py-4 space-y-3">
                          {log.errorMessage && (
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                                {t("developer.logsErrorMessage")}
                              </p>
                              <p className="text-sm text-red-700 font-mono break-words">
                                {log.errorMessage}
                              </p>
                            </div>
                          )}
                          {log.errorStack && (
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                                {t("developer.logsStackTrace")}
                              </p>
                              <pre
                                className={cn(
                                  "text-xs font-mono text-gray-800 bg-white border border-gray-200",
                                  "rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-64"
                                )}
                              >
                                {log.errorStack}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableContainer>
      )}

    </div>
  );
}
