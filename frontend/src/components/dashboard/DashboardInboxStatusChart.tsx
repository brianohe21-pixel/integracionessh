"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { MessageSquare } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import { METRICS_CHART_COLORS, metricsAxisTick, metricsTooltipStyle } from "@/components/metrics/chart-theme";
import type { MarketingMetrics } from "@/types";

interface DashboardInboxStatusChartProps {
  marketing?: MarketingMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardInboxStatusChart({
  marketing,
  isLoading,
  error,
}: DashboardInboxStatusChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();
  const inbox = marketing?.inbox;

  const data = [
    { key: "open", label: t("metrics.inboxOpen"), value: inbox?.open ?? 0 },
    { key: "pending", label: t("metrics.inboxPending"), value: inbox?.pending ?? 0 },
    { key: "resolved", label: t("metrics.resolvedToday"), value: inbox?.resolvedToday ?? 0 },
  ];

  const isEmpty = !isLoading && !error && data.every((d) => d.value === 0);

  return (
    <DashboardWidgetCard
      title={t("metrics.chartInboxTitle")}
      subtitle={t("metrics.chartInboxSubtitle")}
      detailHref="/metrics"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.chartInboxEmpty")}
      emptyDescription={t("metrics.chartInboxEmptyDescription")}
      emptyIcon={<MessageSquare className="h-5 w-5" />}
    >
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={metricsAxisTick} axisLine={false} tickLine={false} />
            <YAxis
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={metricsTooltipStyle}
              formatter={(value) => [formatNumber(Number(value)), t("metrics.chartCount")]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell key={entry.key} fill={METRICS_CHART_COLORS[index % METRICS_CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}
