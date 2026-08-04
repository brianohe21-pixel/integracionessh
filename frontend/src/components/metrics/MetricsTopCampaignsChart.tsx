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
import { MetricsChartCard } from "./MetricsChartCard";
import { chartBotLabel, metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { MarketingMetrics } from "@/types";

interface MetricsTopCampaignsChartProps {
  marketing: MarketingMetrics;
}

export function MetricsTopCampaignsChart({ marketing }: MetricsTopCampaignsChartProps) {
  const t = useT();
  const data = (marketing.topCampaigns ?? []).map((c) => ({
    ...chartBotLabel(c.name, 16),
    deliveryRate: c.deliveryRate,
    readRate: c.readRate,
  }));

  return (
    <MetricsChartCard
      title={t("metrics.chartTopCampaignsTitle")}
      subtitle={t("metrics.chartTopCampaignsSubtitle")}
      isEmpty={data.length === 0}
      emptyTitle={t("metrics.chartTopCampaignsEmpty")}
      emptyDescription={t("metrics.chartTopCampaignsEmptyDescription")}
      emptyIcon={<Megaphone className="h-5 w-5" />}
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
    </MetricsChartCard>
  );
}
