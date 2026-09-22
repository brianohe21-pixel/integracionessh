"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/ui/StatCard";
import { TableContainer } from "@/components/ui/TableContainer";
import { ApiUsageLogsPanel } from "@/components/developer/ApiUsageLogsPanel";
import { UsageDateFilters } from "@/components/developer/UsageDateFilters";
import { MetricsChartCard } from "@/components/metrics/MetricsChartCard";
import {
  METRICS_CHART_COLORS,
  metricsAxisTick,
  metricsTooltipStyle,
} from "@/components/metrics/chart-theme";
import { useApiKeyUsage } from "@/hooks/useApiKeys";
import { useFormatters } from "@/hooks/useFormatters";
import { currentMonthRange, type MetricsDateRange } from "@/lib/metrics-date-range";
import { useT } from "@/i18n/context";
import type { ApiKeyUsageSummary } from "@/types";

const BAR_CHART_MARGIN = { top: 8, right: 12, left: 4, bottom: 28 };
const PIE_CHART_MARGIN = { top: 8, right: 8, left: 8, bottom: 36 };

function truncateLabel(value: string, max = 12): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function buildChartRows(usage: ApiKeyUsageSummary[]) {
  return usage
    .slice()
    .sort((a, b) => b.messagesThisMonth - a.messagesThisMonth)
    .slice(0, 10)
    .map((item, index) => ({
      keyId: item.keyId,
      label: truncateLabel(item.keyName),
      fullName: item.keyName,
      messages: item.messagesThisMonth,
      success: item.successRequests,
      errors: item.errorRequests,
      total: item.totalRequests,
      color: METRICS_CHART_COLORS[index % METRICS_CHART_COLORS.length],
    }));
}

export function ApiUsageChart() {
  const t = useT();
  const { formatNumber } = useFormatters();
  const [dateRange, setDateRange] = useState<MetricsDateRange>(currentMonthRange);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const { data: usage = [], isLoading } = useApiKeyUsage(dateRange);

  const totalMessages = usage.reduce((sum, item) => sum + item.messagesThisMonth, 0);
  const totalSuccess = usage.reduce((sum, item) => sum + item.successRequests, 0);
  const totalErrors = usage.reduce((sum, item) => sum + item.errorRequests, 0);
  const totalAttempts = totalSuccess + totalErrors;
  const successRate =
    totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : 100;

  const chartRows = useMemo(() => buildChartRows(usage), [usage]);

  const outcomeData = useMemo(
    () =>
      [
        {
          key: "success",
          name: t("developer.chartOutcomeSuccess"),
          value: totalSuccess,
          color: "#128c7e",
        },
        {
          key: "errors",
          name: t("developer.chartOutcomeErrors"),
          value: totalErrors,
          color: "#ef4444",
        },
      ].filter((item) => item.value > 0),
    [t, totalSuccess, totalErrors]
  );

  return (
    <div className="space-y-6">
      <UsageDateFilters range={dateRange} onChange={setDateRange} />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl border border-default bg-surface-elevated p-4"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("developer.messagesInPeriod")}
              value={formatNumber(totalMessages)}
              icon={<MessageSquare className="h-5 w-5" />}
            />
            <StatCard
              label={t("developer.successRate")}
              value={`${successRate}%`}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              label={t("developer.successfulRequests")}
              value={formatNumber(totalSuccess)}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              label={t("developer.errors")}
              value={formatNumber(totalErrors)}
              icon={<AlertCircle className="h-5 w-5" />}
            />
          </div>

          {usage.length > 0 ? (
            <div className="grid items-start gap-4 xl:grid-cols-5">
              <MetricsChartCard
                className="overflow-visible xl:col-span-3"
                title={t("developer.messagesByKeyInPeriod")}
                subtitle={t("developer.chartMessagesSubtitle")}
                isEmpty={chartRows.length === 0}
                emptyTitle={t("developer.noUsageData")}
                emptyIcon={<BarChart3 className="h-5 w-5" />}
              >
                <div className="h-80 w-full min-w-0 pb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} margin={BAR_CHART_MARGIN}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={metricsAxisTick} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={metricsAxisTick}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatNumber(value)}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--accent-muted)" }}
                        contentStyle={metricsTooltipStyle}
                        formatter={(value) => [formatNumber(Number(value)), t("developer.messagesInPeriod")]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                      />
                      <Bar dataKey="messages" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {chartRows.map((row) => (
                          <Cell key={row.keyId} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </MetricsChartCard>

              <MetricsChartCard
                className="overflow-visible xl:col-span-2"
                title={t("developer.chartOutcomeTitle")}
                subtitle={t("developer.chartOutcomeSubtitle")}
                isEmpty={outcomeData.length === 0}
                emptyTitle={t("developer.noUsageData")}
                emptyIcon={<CheckCircle2 className="h-5 w-5" />}
              >
                <div className="h-80 w-full min-w-0 pb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={PIE_CHART_MARGIN}>
                      <Pie
                        data={outcomeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="42%"
                        innerRadius={52}
                        outerRadius={76}
                        paddingAngle={3}
                      >
                        {outcomeData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={metricsTooltipStyle}
                        formatter={(value, _name, item) => [
                          formatNumber(Number(value)),
                          item.payload.name,
                        ]}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </MetricsChartCard>
            </div>
          ) : null}

          {usage.length > 0 ? (
            <MetricsChartCard
              className="overflow-visible"
              title={t("developer.chartRequestsTitle")}
              subtitle={t("developer.chartRequestsSubtitle")}
              isEmpty={chartRows.length === 0}
              emptyTitle={t("developer.noUsageData")}
              emptyIcon={<BarChart3 className="h-5 w-5" />}
            >
              <div className="h-80 w-full min-w-0 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={BAR_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={metricsAxisTick} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={metricsAxisTick}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatNumber(value)}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--accent-muted)" }}
                      contentStyle={metricsTooltipStyle}
                      formatter={(value, name) => {
                        if (name === "success") {
                          return [formatNumber(Number(value)), t("developer.colSuccess")];
                        }
                        if (name === "errors") {
                          return [formatNumber(Number(value)), t("developer.colErrors")];
                        }
                        return [formatNumber(Number(value)), String(name)];
                      }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          {value}
                        </span>
                      )}
                    />
                    <Bar
                      dataKey="success"
                      name={t("developer.colSuccess")}
                      fill="#128c7e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="errors"
                      name={t("developer.colErrors")}
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MetricsChartCard>
          ) : null}

          <div className="content-card overflow-hidden">
            <div className="section-header border-b border-default">
              <h3 className="section-header-title">{t("developer.usageByKey")}</h3>
            </div>
            {usage.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">{t("developer.noUsageData")}</p>
            ) : (
              <TableContainer card={false}>
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="bg-surface text-left text-xs uppercase tracking-wide text-secondary">
                      <th className="px-6 py-3 font-medium">{t("developer.colKey")}</th>
                      <th className="px-6 py-3 text-right font-medium">{t("developer.colRequests")}</th>
                      <th className="px-6 py-3 text-right font-medium">{t("developer.colSuccess")}</th>
                      <th className="px-6 py-3 text-right font-medium">{t("developer.colErrors")}</th>
                      <th className="px-6 py-3 font-medium">{t("developer.colLastUsed")}</th>
                      <th className="px-6 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {usage.map((item) => (
                      <tr key={item.keyId} className="hover:bg-surface/50">
                        <td className="px-6 py-3.5">
                          <div className="font-medium text-primary">{item.keyName}</div>
                          <code className="font-mono text-xs text-muted">{item.prefix}…</code>
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-secondary">
                          {formatNumber(item.totalRequests)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-green-700">
                          {formatNumber(item.successRequests)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-red-500">
                          {formatNumber(item.errorRequests)}
                        </td>
                        <td className="px-6 py-3.5 text-secondary">
                          {item.lastUsedAt
                            ? new Date(item.lastUsedAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedKeyId(item.keyId)}
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
