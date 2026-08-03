"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Banknote } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { MetricsChartCard } from "./MetricsChartCard";
import { METRICS_CHART_COLORS, metricsTooltipStyle } from "./chart-theme";
import type { SalesMetrics, PaymentRequestSource } from "@/types";

const SALES_SOURCES: PaymentRequestSource[] = [
  "manual",
  "flow",
  "catalog_order",
  "calendar_booking",
  "quotation",
];

interface MetricsSalesBySourceChartProps {
  sales: SalesMetrics;
}

export function MetricsSalesBySourceChart({ sales }: MetricsSalesBySourceChartProps) {
  const t = useT();
  const { formatCurrency } = useFormatters();

  const data = SALES_SOURCES
    .filter((source) => sales.bySource[source].revenueInCents > 0)
    .map((source) => ({
      key: source,
      name: t(`metrics.salesSources.${source}`),
      value: sales.bySource[source].revenueInCents,
    }));

  return (
    <MetricsChartCard
      title={t("metrics.chartSalesBySourceTitle")}
      subtitle={t("metrics.chartSalesBySourceSubtitle")}
      isEmpty={data.length === 0}
      emptyTitle={t("metrics.salesEmptyTitle")}
      emptyDescription={t("metrics.salesEmptyDescription")}
      emptyIcon={<Banknote className="h-5 w-5" />}
    >
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={88}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.key} fill={METRICS_CHART_COLORS[index % METRICS_CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={metricsTooltipStyle}
              formatter={(value, _name, item) => [
                formatCurrency(Number(value)),
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
  );
}
