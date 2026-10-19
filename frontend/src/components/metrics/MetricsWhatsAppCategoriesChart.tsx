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
import { MessageSquareText } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { MetricsChartCard } from "./MetricsChartCard";
import { METRICS_CHART_COLORS, metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { WhatsAppCategoryReport, WhatsAppPricingCategory } from "@/types";

interface MetricsWhatsAppCategoriesChartProps {
  report: WhatsAppCategoryReport;
}

const CATEGORY_LABEL_KEYS: Record<WhatsAppPricingCategory, string> = {
  MARKETING: "metrics.whatsappCategoryMarketing",
  UTILITY: "metrics.whatsappCategoryUtility",
  AUTHENTICATION: "metrics.whatsappCategoryAuthentication",
  SERVICE: "metrics.whatsappCategoryService",
};

export function MetricsWhatsAppCategoriesChart({
  report,
}: MetricsWhatsAppCategoriesChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const data = report.byCategory.map((row) => ({
    key: row.category,
    label: t(CATEGORY_LABEL_KEYS[row.category]),
    value: row.count,
  }));

  const isEmpty = !data.some((row) => row.value > 0);

  return (
    <MetricsChartCard
      title={t("metrics.chartWhatsAppCategoriesTitle")}
      subtitle={t("metrics.chartWhatsAppCategoriesSubtitle")}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.chartWhatsAppCategoriesEmpty")}
      emptyDescription={t("metrics.chartWhatsAppCategoriesEmptyDescription")}
      emptyIcon={<MessageSquareText className="h-5 w-5" />}
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
