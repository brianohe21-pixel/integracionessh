"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Globe } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { MetricsChartCard } from "./MetricsChartCard";
import { metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { WebsiteMetricsTopRow } from "@/types";

interface MetricsWebsiteTopListChartProps {
  title: string;
  subtitle: string;
  rows: WebsiteMetricsTopRow[];
  emptyTitle: string;
  emptyDescription: string;
}

export function MetricsWebsiteTopListChart({
  title,
  subtitle,
  rows,
  emptyTitle,
  emptyDescription,
}: MetricsWebsiteTopListChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const data = rows.map((row) => ({
    label: row.label.length > 28 ? `${row.label.slice(0, 28)}…` : row.label,
    count: row.count,
  }));

  return (
    <MetricsChartCard
      title={title}
      subtitle={subtitle}
      isEmpty={rows.length === 0}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyIcon={<Globe className="h-5 w-5" />}
    >
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={metricsTooltipStyle}
              formatter={(value) => [formatNumber(Number(value)), t("metrics.websitePageviews")]}
            />
            <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </MetricsChartCard>
  );
}
