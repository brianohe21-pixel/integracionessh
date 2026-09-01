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
import { Tags } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { interactionCategoryLabelKey } from "@/lib/interaction-categories";
import { MetricsChartCard } from "./MetricsChartCard";
import { METRICS_CHART_COLORS, metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { ConversationCategoryMetrics } from "@/types";

interface MetricsConversationCategoriesChartProps {
  metrics: ConversationCategoryMetrics;
}

export function MetricsConversationCategoriesChart({
  metrics,
}: MetricsConversationCategoriesChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const data = metrics.byCategory.map((row) => ({
    key: row.category,
    label: t(interactionCategoryLabelKey(row.category)),
    value: row.count,
  }));

  const isEmpty = data.length === 0;

  return (
    <MetricsChartCard
      title={t("metrics.chartConversationCategoriesTitle")}
      subtitle={t("metrics.chartConversationCategoriesSubtitle")}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.chartConversationCategoriesEmpty")}
      emptyDescription={t("metrics.chartConversationCategoriesEmptyDescription")}
      emptyIcon={<Tags className="h-5 w-5" />}
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
    </MetricsChartCard>
  );
}
