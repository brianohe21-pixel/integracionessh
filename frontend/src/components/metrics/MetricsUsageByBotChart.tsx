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
import { BotMessageSquare } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { MetricsChartCard } from "./MetricsChartCard";
import { chartBotLabel, metricsAxisTick, metricsTooltipStyle } from "./chart-theme";
import type { UsageMetrics } from "@/types";

interface MetricsUsageByBotChartProps {
  usage: UsageMetrics;
}

export function MetricsUsageByBotChart({ usage }: MetricsUsageByBotChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const data = usage.byBot
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 8)
    .map((bot) => ({
      ...chartBotLabel(bot.botName),
      messages: bot.messages,
      conversations: bot.conversations,
    }));

  return (
    <MetricsChartCard
      title={t("metrics.chartUsageByBotTitle")}
      subtitle={t("metrics.chartUsageByBotSubtitle")}
      isEmpty={data.length === 0}
      emptyTitle={t("metrics.emptyTitle")}
      emptyDescription={t("metrics.emptyDescription")}
      emptyIcon={<BotMessageSquare className="h-5 w-5" />}
    >
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={metricsAxisTick} axisLine={false} tickLine={false} />
            <YAxis
              tick={metricsAxisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={metricsTooltipStyle}
              formatter={(value, name) => [
                formatNumber(Number(value)),
                name === "messages" ? t("metrics.messages") : t("metrics.conversations"),
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
              dataKey="messages"
              name={t("metrics.messages")}
              fill="#128c7e"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="conversations"
              name={t("metrics.conversations")}
              fill="#2dd4bf"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </MetricsChartCard>
  );
}
