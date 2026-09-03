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
import { Megaphone } from "lucide-react";
import { useT } from "@/i18n/context";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import { chartBotLabel, metricsAxisTick, metricsTooltipStyle } from "@/components/metrics/chart-theme";
import type { MarketingMetrics } from "@/types";

interface DashboardTopCampaignsChartProps {
  marketing?: MarketingMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardTopCampaignsChart({
  marketing,
  isLoading,
  error,
}: DashboardTopCampaignsChartProps) {
  const t = useT();

  const data = (marketing?.topCampaigns ?? []).map((c) => ({
    ...chartBotLabel(c.name, 16),
    deliveryRate: c.deliveryRate,
    readRate: c.readRate,
  }));

  const isEmpty = !isLoading && !error && data.length === 0;

  return (
    <DashboardWidgetCard
      title={t("metrics.chartTopCampaignsTitle")}
      subtitle={t("metrics.chartTopCampaignsSubtitle")}
      detailHref="/metrics"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.chartTopCampaignsEmpty")}
      emptyDescription={t("metrics.chartTopCampaignsEmptyDescription")}
      emptyIcon={<Megaphone className="h-5 w-5" />}
    >
      <div className="h-56 w-full min-w-0">
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
              formatter={(value, name) => [
                `${value}%`,
                name === "deliveryRate" ? t("metrics.deliveryRate") : t("metrics.readRate"),
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{value}</span>
              )}
            />
            <Bar
              dataKey="deliveryRate"
              name={t("metrics.deliveryRate")}
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="readRate"
              name={t("metrics.readRate")}
              fill="#128c7e"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}
