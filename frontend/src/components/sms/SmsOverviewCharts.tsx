"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Layers3, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import { MetricsChartCard } from "@/components/metrics/MetricsChartCard";
import {
  METRICS_CHART_COLORS,
  metricsAxisTick,
  metricsTooltipStyle,
} from "@/components/metrics/chart-theme";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { SmsOverviewCharts } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  delivered: "#128c7e",
  sent: "#3b82f6",
  pending: "#f59e0b",
  delivery_failed: "#ef4444",
  send_failed: "#dc2626",
};

interface SmsOverviewChartsProps {
  charts: SmsOverviewCharts;
}

export function SmsOverviewChartsPanel({ charts }: SmsOverviewChartsProps) {
  const t = useT();
  const { formatNumber, formatDate } = useFormatters();

  const dailyData = charts.dailyTrend.map((row) => ({
    ...row,
    label: formatDate(`${row.date}T12:00:00.000Z`),
  }));

  const statusData = charts.byStatus.map((row) => ({
    key: row.status,
    name: t(`smsDashboard.history.status.${row.status}`),
    value: row.count,
  }));

  const sourceData = charts.bySource.map((row) => ({
    key: row.source,
    name: t(`smsDashboard.history.source.${row.source}`),
    value: row.count,
  }));

  const channelData = charts.byChannel.map((row) => ({
    key: row.channel,
    label: t(`smsDashboard.overview.charts.channel.${row.channel}`),
    sent: row.sent,
    failed: row.failed,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricsChartCard
          title={t("smsDashboard.overview.charts.dailyTitle")}
          subtitle={t("smsDashboard.overview.charts.dailySubtitle")}
          isEmpty={dailyData.length === 0}
          emptyTitle={t("smsDashboard.overview.charts.emptyTitle")}
          emptyDescription={t("smsDashboard.overview.charts.emptyDescription")}
          emptyIcon={<TrendingUp className="h-5 w-5" />}
        >
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
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
                  contentStyle={metricsTooltipStyle}
                  formatter={(value, name) => {
                    if (name === "delivered") {
                      return [formatNumber(Number(value)), t("smsDashboard.overview.delivered")];
                    }
                    if (name === "failed") {
                      return [formatNumber(Number(value)), t("smsDashboard.overview.failed")];
                    }
                    return [formatNumber(Number(value)), t("smsDashboard.overview.totalSends")];
                  }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name={t("smsDashboard.overview.totalSends")}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="delivered"
                  name={t("smsDashboard.overview.delivered")}
                  stroke="#128c7e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  name={t("smsDashboard.overview.failed")}
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </MetricsChartCard>

        <MetricsChartCard
          title={t("smsDashboard.overview.charts.statusTitle")}
          subtitle={t("smsDashboard.overview.charts.statusSubtitle")}
          isEmpty={statusData.length === 0}
          emptyTitle={t("smsDashboard.overview.charts.emptyTitle")}
          emptyDescription={t("smsDashboard.overview.charts.emptyDescription")}
          emptyIcon={<PieChartIcon className="h-5 w-5" />}
        >
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? METRICS_CHART_COLORS[0]} />
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
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </MetricsChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricsChartCard
          title={t("smsDashboard.overview.charts.sourceTitle")}
          subtitle={t("smsDashboard.overview.charts.sourceSubtitle")}
          isEmpty={sourceData.length === 0}
          emptyTitle={t("smsDashboard.overview.charts.emptyTitle")}
          emptyDescription={t("smsDashboard.overview.charts.emptyDescription")}
          emptyIcon={<Layers3 className="h-5 w-5" />}
        >
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={metricsAxisTick} axisLine={false} tickLine={false} />
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
                  formatter={(value) => [formatNumber(Number(value)), t("smsDashboard.overview.totalSends")]}
                />
                <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MetricsChartCard>

        <MetricsChartCard
          title={t("smsDashboard.overview.charts.channelTitle")}
          subtitle={t("smsDashboard.overview.charts.channelSubtitle")}
          isEmpty={channelData.length === 0}
          emptyTitle={t("smsDashboard.overview.charts.emptyTitle")}
          emptyDescription={t("smsDashboard.overview.charts.emptyDescription")}
          emptyIcon={<BarChart3 className="h-5 w-5" />}
        >
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
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
                    if (name === "sent") {
                      return [formatNumber(Number(value)), t("smsDashboard.overview.charts.sent")];
                    }
                    return [formatNumber(Number(value)), t("smsDashboard.overview.failed")];
                  }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Bar
                  dataKey="sent"
                  name={t("smsDashboard.overview.charts.sent")}
                  fill="#128c7e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="failed"
                  name={t("smsDashboard.overview.failed")}
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MetricsChartCard>
      </div>
    </div>
  );
}
