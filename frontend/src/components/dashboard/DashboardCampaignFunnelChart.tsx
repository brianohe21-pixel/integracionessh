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
import { Megaphone } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import type { MarketingMetrics } from "@/types";

const FUNNEL_COLORS = ["#94a3b8", "#3b82f6", "#16a34a", "#128c7e"];

interface DashboardCampaignFunnelChartProps {
  marketing?: MarketingMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardCampaignFunnelChart({
  marketing,
  isLoading,
  error,
}: DashboardCampaignFunnelChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const aggregates = marketing?.campaigns.aggregates;
  const data = aggregates
    ? [
        { key: "sent", label: t("dashboard.funnelSent"), value: aggregates.sent },
        { key: "delivered", label: t("dashboard.funnelDelivered"), value: aggregates.delivered },
        { key: "read", label: t("dashboard.funnelRead"), value: aggregates.read },
      ]
    : [];

  const isEmpty = data.every((d) => d.value === 0);

  return (
    <DashboardWidgetCard
      title={t("dashboard.campaignFunnelTitle")}
      subtitle={t("dashboard.campaignFunnelSubtitle")}
      detailHref="/campaigns"
      isLoading={isLoading}
      error={error}
      isEmpty={!isLoading && !error && isEmpty}
      emptyTitle={t("dashboard.campaignFunnelEmptyTitle")}
      emptyDescription={t("dashboard.campaignFunnelEmptyDescription")}
      emptyIcon={<Megaphone className="h-5 w-5" />}
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
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={80}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [formatNumber(Number(value)), t("dashboard.funnelCount")]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {data.map((entry, index) => (
                <Cell key={entry.key} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}
