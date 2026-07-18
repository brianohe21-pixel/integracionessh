"use client";

import { useState } from "react";
import { TableContainer } from "@/components/ui/TableContainer";
import { ApiUsageLogsPanel } from "@/components/developer/ApiUsageLogsPanel";
import { UsageDateFilters } from "@/components/developer/UsageDateFilters";
import { useApiKeyUsage } from "@/hooks/useApiKeys";
import { currentMonthRange, type MetricsDateRange } from "@/lib/metrics-date-range";
import { useT } from "@/i18n/context";

function BarChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.floor(560 / data.length) - 6;

  return (
    <TableContainer>
      <svg
        viewBox={`0 0 580 180`}
        className="w-full"
        aria-label="API usage bar chart"
        role="img"
      >
        {data.map((d, i) => {
          const barH = Math.max(4, Math.round((d.value / max) * 120));
          const x = i * (barWidth + 6) + 10;
          const y = 130 - barH;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                className={d.color}
              />
              <text
                x={x + barWidth / 2}
                y={150}
                textAnchor="middle"
                className="fill-gray-500 text-[9px]"
                fontSize={9}
              >
                {d.label}
              </text>
              {d.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-gray-600 text-[9px]"
                  fontSize={9}
                >
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </TableContainer>
  );
}

export function ApiUsageChart() {
  const t = useT();
  const [dateRange, setDateRange] = useState<MetricsDateRange>(currentMonthRange);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const { data: usage = [], isLoading } = useApiKeyUsage(dateRange);
  const totalMessages = usage.reduce((sum, u) => sum + u.messagesThisMonth, 0);
  const totalSuccess = usage.reduce((sum, u) => sum + u.successRequests, 0);
  const totalErrors = usage.reduce((sum, u) => sum + u.errorRequests, 0);
  const totalAttempts = totalSuccess + totalErrors;
  const successRate =
    totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : 100;

  const chartData = usage.slice(0, 12).map((u) => ({
    label: u.keyName.slice(0, 8),
    value: u.messagesThisMonth,
    color: "fill-accent",
  }));

  return (
    <div className="space-y-6">
      <UsageDateFilters range={dateRange} onChange={setDateRange} />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-elevated rounded-xl border border-default p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : (
        <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-elevated rounded-xl border border-default p-4">
          <p className="text-xs text-secondary uppercase tracking-wide font-medium">
            {t("developer.messagesInPeriod")}
          </p>
          <p className="text-2xl font-bold text-primary mt-1">
            {totalMessages.toLocaleString()}
          </p>
        </div>
        <div className="bg-surface-elevated rounded-xl border border-default p-4">
          <p className="text-xs text-secondary uppercase tracking-wide font-medium">
            {t("developer.successRate")}
          </p>
          <p className="text-2xl font-bold text-green-600 mt-1">{successRate}%</p>
        </div>
        <div className="bg-surface-elevated rounded-xl border border-default p-4">
          <p className="text-xs text-secondary uppercase tracking-wide font-medium">
            {t("developer.successfulRequests")}
          </p>
          <p className="text-2xl font-bold text-primary mt-1">{totalSuccess.toLocaleString()}</p>
        </div>
        <div className="bg-surface-elevated rounded-xl border border-default p-4">
          <p className="text-xs text-secondary uppercase tracking-wide font-medium">
            {t("developer.errors")}
          </p>
          <p className="text-2xl font-bold text-red-500 mt-1">{totalErrors.toLocaleString()}</p>
        </div>
      </div>

      {usage.length > 0 && (
        <div className="bg-surface-elevated rounded-xl border border-default p-6">
          <h3 className="text-sm font-semibold text-primary mb-4">
            {t("developer.messagesByKeyInPeriod")}
          </h3>
          {chartData.length > 0 ? (
            <BarChart data={chartData} />
          ) : (
            <p className="text-sm text-muted text-center py-8">No data yet</p>
          )}
        </div>
      )}

      <div className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle">
          <h3 className="text-sm font-semibold text-primary">{t("developer.usageByKey")}</h3>
        </div>
        {usage.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No usage data yet</p>
        ) : (
          <TableContainer>
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="bg-surface text-left text-xs text-secondary uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">{t("developer.colKey")}</th>
                  <th className="px-6 py-3 font-medium text-right">{t("developer.colRequests")}</th>
                  <th className="px-6 py-3 font-medium text-right">{t("developer.colSuccess")}</th>
                  <th className="px-6 py-3 font-medium text-right">{t("developer.colErrors")}</th>
                  <th className="px-6 py-3 font-medium">{t("developer.colLastUsed")}</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usage.map((u) => (
                  <tr key={u.keyId} className="hover:bg-surface/50">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-primary">{u.keyName}</div>
                      <code className="text-xs text-muted font-mono">{u.prefix}…</code>
                    </td>
                    <td className="px-6 py-3.5 text-right text-secondary font-medium">
                      {u.totalRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right text-green-700">
                      {u.successRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right text-red-500">
                      {u.errorRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-secondary">
                      {u.lastUsedAt
                        ? new Date(u.lastUsedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedKeyId(u.keyId)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        {t("developer.viewLogs")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </div>

      <ApiUsageLogsPanel
        keys={usage}
        selectedKeyId={selectedKeyId}
        onSelectKey={setSelectedKeyId}
        dateRange={dateRange}
      />
        </>
      )}
    </div>
  );
}
