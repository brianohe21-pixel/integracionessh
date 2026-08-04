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

interface MetricsTopProductsChartProps {
  sales: SalesMetrics;
}

export function MetricsTopProductsChart({ sales }: MetricsTopProductsChartProps) {
  const t = useT();
  const { formatCurrency, formatNumber } = useFormatters();

  const data = sales.topProducts.map((product) => ({
    ...chartBotLabel(product.name, 18),
    revenue: product.revenueInCents,
    orders: product.orderCount,
  }));

  return (
    <MetricsChartCard
      title={t("metrics.chartTopProductsTitle")}
      subtitle={t("metrics.chartTopProductsSubtitle")}
      isEmpty={data.length === 0}
      emptyTitle={t("metrics.chartTopProductsEmpty")}
      emptyDescription={t("metrics.salesEmptyDescription")}
      emptyIcon={<Banknote className="h-5 w-5" />}
    >
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={metricsTooltipStyle}
              formatter={(value, _name, item) => [
                formatCurrency(Number(value)),
                `${formatNumber(item.payload.orders)} ${t("metrics.productOrders").toLowerCase()}`,
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={28}>
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
