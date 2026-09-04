"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Phone } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import { metricsAxisTick, metricsTooltipStyle } from "@/components/metrics/chart-theme";
import type { CallingMetrics } from "@/types";

interface DashboardCallingSummaryChartProps {
  calling?: CallingMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardCallingSummaryChart({
  calling,
  isLoading,
  error,
}: DashboardCallingSummaryChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();
  const summary = calling?.summary;

  const data = [
    {
      key: "outbound",
      label: t("metrics.chartCallingOutbound"),
      answered: summary?.outboundPickedUp ?? 0,
      missed: summary?.outboundMissed ?? 0,
    },
    {
      key: "inbound",
      label: t("metrics.chartCallingInbound"),
      answered: summary?.inboundAnswered ?? 0,
      missed: (summary?.inboundCalls ?? 0) - (summary?.inboundAnswered ?? 0),
    },
  ];

  const isEmpty = !isLoading && !error && (summary?.totalCalls ?? 0) === 0;

  return (
    <DashboardWidgetCard
      title={t("metrics.chartCallingSummaryTitle")}
      subtitle={t("metrics.chartCallingSummarySubtitle")}
      detailHref="/metrics"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.callingEmptyTitle")}
      emptyDescription={t("metrics.callingEmptyDescription")}
      emptyIcon={<Phone className="h-5 w-5" />}
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
              formatter={(value, name) => {
                if (name === "answered") {
                  return [formatNumber(Number(value)), t("metrics.chartCallingAnswered")];
                }
                return [formatNumber(Number(value)), t("metrics.chartCallingMissed")];
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{value}</span>
              )}
            />
            <Bar
              dataKey="answered"
              name={t("metrics.chartCallingAnswered")}
              fill="#128c7e"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="missed"
              name={t("metrics.chartCallingMissed")}
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}
