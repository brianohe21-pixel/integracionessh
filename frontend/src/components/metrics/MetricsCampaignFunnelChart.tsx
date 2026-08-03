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
import { SendHorizonal } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { MetricsChartCard } from "./MetricsChartCard";
import {
  METRICS_FUNNEL_COLORS,
  metricsAxisTick,
  metricsTooltipStyle,
} from "./chart-theme";
import type { MarketingMetrics } from "@/types";

interface MetricsCampaignFunnelChartProps {
  marketing: MarketingMetrics;
}

export function MetricsCampaignFunnelChart({ marketing }: MetricsCampaignFunnelChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();
  const aggregates = marketing.campaigns.aggregates;

  const data = [
    { key: "sent", label: t("metrics.chartFunnelSent"), value: aggregates.sent },
    { key: "delivered", label: t("metrics.chartFunnelDelivered"), value: aggregates.delivered },
    { key: "read", label: t("metrics.chartFunnelRead"), value: aggregates.read },
  ];

  const isEmpty = data.every((d) => d.value === 0);

  return (
    <MetricsChartCard
      title={t("metrics.chartCampaignFunnelTitle")}
      subtitle={t("metrics.chartCampaignFunnelSubtitle")}
      isEmpty={isEmpty}
      emptyTitle={t("metrics.chartCampaignFunnelEmpty")}
      emptyDescription={t("metrics.chartCampaignFunnelEmptyDescription")}
      emptyIcon={<SendHorizonal className="h-5 w-5" />}
    >
      <div className="h-64 w-full min-w-0">
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
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={88}
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={metricsTooltipStyle}
              formatter={(value) => [formatNumber(Number(value)), t("metrics.chartCount")]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {data.map((entry, index) => (
                <Cell key={entry.key} fill={METRICS_FUNNEL_COLORS[index % METRICS_FUNNEL_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </MetricsChartCard>
  );
}
