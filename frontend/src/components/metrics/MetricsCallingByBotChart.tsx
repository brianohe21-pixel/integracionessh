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
import { Phone } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { MetricsChartCard } from "./MetricsChartCard";
import { chartBotLabel, metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { CallingMetrics } from "@/types";

interface MetricsCallingByBotChartProps {
  calling: CallingMetrics;
}

export function MetricsCallingByBotChart({ calling }: MetricsCallingByBotChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const data = calling.byBot.map((bot) => ({
    ...chartBotLabel(bot.botName),
    pickupRate: bot.pickupRate,
    outboundAttempts: bot.outboundAttempts,
    outboundPickedUp: bot.outboundPickedUp,
  }));

  return (
    <MetricsChartCard
      title={t("metrics.chartCallingByBotTitle")}
      subtitle={t("metrics.chartCallingByBotSubtitle")}
      isEmpty={data.length === 0}
      emptyTitle={t("metrics.callingEmptyTitle")}
      emptyDescription={t("metrics.callingEmptyDescription")}
      emptyIcon={<Phone className="h-5 w-5" />}
    >
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={metricsAxisTick} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="rate"
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={metricsTooltipStyle}
              formatter={(value, name) => {
                if (name === "pickupRate") return [`${value}%`, t("metrics.pickupRate")];
                if (name === "outboundAttempts") return [formatNumber(Number(value)), t("metrics.colOutbound")];
                return [formatNumber(Number(value)), t("metrics.colPickedUp")];
              }}
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
              yAxisId="rate"
              dataKey="pickupRate"
              name={t("metrics.pickupRate")}
              fill="#128c7e"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              yAxisId="count"
              dataKey="outboundAttempts"
              name={t("metrics.colOutbound")}
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              yAxisId="count"
              dataKey="outboundPickedUp"
              name={t("metrics.colPickedUp")}
              fill="#2dd4bf"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </MetricsChartCard>
  );
}
