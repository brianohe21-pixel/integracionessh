"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Globe } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import { metricsAxisTick, metricsTooltipStyle } from "@/components/metrics/chart-theme";
import type { WebsiteMetrics } from "@/types";

interface DashboardWebsiteTrendChartProps {
  website?: WebsiteMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardWebsiteTrendChart({
  website,
  isLoading,
  error,
}: DashboardWebsiteTrendChartProps) {
  const t = useT();
  const { formatNumber, formatDate } = useFormatters();

  const data = (website?.dailyTrend ?? []).map((row) => ({
    ...row,
    label: formatDate(`${row.date}T12:00:00.000Z`),
  }));

  const isEmpty = !isLoading && !error && (website?.summary.pageviews ?? 0) === 0;

  return (
    <DashboardWidgetCard
      title={t("metrics.websiteTrendTitle")}
      subtitle={t("metrics.websiteTrendSubtitle")}
      detailHref="/metrics"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.websiteEmptyTitle")}
      emptyDescription={t("metrics.websiteEmptyDescription")}
      emptyIcon={<Globe className="h-5 w-5" />}
    >
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
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
              contentStyle={metricsTooltipStyle}
              formatter={(value, name) => {
                if (name === "pageviews") {
                  return [formatNumber(Number(value)), t("metrics.websitePageviews")];
                }
                if (name === "uniqueVisitors") {
                  return [formatNumber(Number(value)), t("metrics.websiteVisitors")];
                }
                return [formatNumber(Number(value)), t("metrics.websiteSessions")];
              }}
            />
            <Legend iconType="circle" iconSize={8} />
            <Line
              type="monotone"
              dataKey="pageviews"
              name={t("metrics.websitePageviews")}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="uniqueVisitors"
              name={t("metrics.websiteVisitors")}
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="sessions"
              name={t("metrics.websiteSessions")}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}
