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
import { MetricsChartCard } from "./MetricsChartCard";
import { metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { CallingMetrics } from "@/types";

interface MetricsCallingSummaryChartProps {
  calling: CallingMetrics;
}

export function MetricsCallingSummaryChart({ calling }: MetricsCallingSummaryChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();
  const summary = calling.summary;

  const data = [
    {
      key: "outbound",
      label: t("metrics.chartCallingOutbound"),
      attempts: summary.outboundAttempts,
      answered: summary.outboundPickedUp,
      missed: summary.outboundMissed,
    },
    {
      key: "inbound",
      label: t("metrics.chartCallingInbound"),
      attempts: summary.inboundCalls,
      answered: summary.inboundAnswered,
      missed: summary.inboundCalls - summary.inboundAnswered,
    },
  ];

  const isEmpty = summary.totalCalls === 0;

  return (
    <MetricsChartCard
      title={t("metrics.chartCallingSummaryTitle")}
      subtitle={t("metrics.chartCallingSummarySubtitle")}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.callingEmptyTitle")}
      emptyDescription={t("metrics.callingEmptyDescription")}
      emptyIcon={<Phone className="h-5 w-5" />}
    >
      <div className="h-64 w-full min-w-0">
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
                if (name === "answered") return [formatNumber(Number(value)), t("metrics.chartCallingAnswered")];
                if (name === "missed") return [formatNumber(Number(value)), t("metrics.chartCallingMissed")];
                return [formatNumber(Number(value)), t("metrics.colOutbound")];
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
    </MetricsChartCard>
  );
}
