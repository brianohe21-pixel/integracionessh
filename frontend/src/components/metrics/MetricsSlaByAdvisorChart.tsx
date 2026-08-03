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
import { Users } from "lucide-react";
import { useT } from "@/i18n/context";
import { MetricsChartCard } from "./MetricsChartCard";
import { METRICS_CHART_COLORS, metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { InboxSlaMetrics } from "@/types";

interface MetricsSlaByAdvisorChartProps {
  inboxSla: InboxSlaMetrics;
}

export function MetricsSlaByAdvisorChart({ inboxSla }: MetricsSlaByAdvisorChartProps) {
  const t = useT();
  const data = inboxSla.byAdvisor
    .filter((a) => a.metCount + a.missedCount > 0)
    .slice(0, 8)
    .map((advisor) => ({
      name: advisor.advisorId.length > 12 ? `${advisor.advisorId.slice(0, 12)}…` : advisor.advisorId,
      fullName: advisor.advisorId,
      complianceRate: advisor.complianceRate,
    }));

  return (
    <MetricsChartCard
      title={t("metrics.chartSlaByAdvisorTitle")}
      subtitle={t("metrics.chartSlaByAdvisorSubtitle", {
        minutes: inboxSla.firstResponseMinutes ?? 5,
      })}
      isEmpty={data.length === 0}
      emptyTitle={t("metrics.chartSlaByAdvisorEmpty")}
      emptyDescription={t("metrics.chartSlaByAdvisorEmptyDescription")}
      emptyIcon={<Users className="h-5 w-5" />}
    >
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={metricsAxisTick} axisLine={false} tickLine={false} />
            <YAxis
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={metricsTooltipStyle}
              formatter={(value) => [`${value}%`, t("metrics.inboxSlaCompliance")]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Bar dataKey="complianceRate" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((_, index) => (
                <Cell key={index} fill={METRICS_CHART_COLORS[index % METRICS_CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </MetricsChartCard>
  );
}
