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
import { Banknote } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { MetricsChartCard } from "./MetricsChartCard";
import { chartBotLabel, METRICS_CHART_COLORS, metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { SalesMetrics } from "@/types";

interface MetricsSalesByBotChartProps {
  sales: SalesMetrics;
}

export function MetricsSalesByBotChart({ sales }: MetricsSalesByBotChartProps) {
  const t = useT();
  const { formatCurrency } = useFormatters();

  const data = sales.byBot.map((bot) => ({
    ...chartBotLabel(bot.botName),
    revenue: bot.revenueInCents,
    count: bot.count,
  }));

  return (
    <MetricsChartCard
      title={t("metrics.chartSalesByBotTitle")}
      subtitle={t("metrics.chartSalesByBotSubtitle")}
      isEmpty={data.length === 0}
      emptyTitle={t("metrics.salesEmptyTitle")}
      emptyDescription={t("metrics.salesEmptyDescription")}
      emptyIcon={<Banknote className="h-5 w-5" />}
    >
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={metricsAxisTick} axisLine={false} tickLine={false} />
            <YAxis
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={metricsTooltipStyle}
              formatter={(value, _name, item) => [
                formatCurrency(Number(value)),
                `${t("metrics.salesRevenue")} (${item.payload.count} ${t("metrics.salesPaidCount").toLowerCase()})`,
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={48}>
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
