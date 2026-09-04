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
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import type { SalesMetrics, PaymentRequestSource } from "@/types";

const SOURCE_COLORS = ["#128c7e", "#2dd4bf", "#0f766e", "#14b8a6", "#0d9488"];

const SALES_SOURCES: PaymentRequestSource[] = [
  "manual",
  "flow",
  "catalog_order",
  "calendar_booking",
  "quotation",
];

interface DashboardSalesBySourceChartProps {
  sales?: SalesMetrics | null;
  rangeLabel: string;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardSalesBySourceChart({
  sales,
  rangeLabel,
  isLoading,
  error,
}: DashboardSalesBySourceChartProps) {
  const t = useT();
  const { formatCurrency } = useFormatters();

  const data = sales
    ? SALES_SOURCES
        .filter((source) => sales.bySource[source].revenueInCents > 0)
        .map((source) => ({
          key: source,
          name: t(`metrics.salesSources.${source}`),
          value: sales.bySource[source].revenueInCents,
          count: sales.bySource[source].count,
        }))
    : [];

  return (
    <DashboardWidgetCard
      title={t("dashboard.salesBySourceTitle")}
      subtitle={t("dashboard.salesBySourceSubtitlePeriod", { period: rangeLabel })}
      detailHref="/metrics?section=sales"
      isLoading={isLoading}
      error={error}
      isEmpty={!isLoading && !error && data.length === 0}
      emptyTitle={t("metrics.salesEmptyTitle")}
      emptyDescription={t("metrics.salesEmptyDescription")}
      emptyIcon={<Banknote className="h-5 w-5" />}
    >
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.key} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
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
    </DashboardWidgetCard>
  );
}
