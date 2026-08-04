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
import { BotMessageSquare } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import type { UsageMetrics } from "@/types";

const CHART_COLORS = ["#128c7e", "#2dd4bf", "#0f766e", "#14b8a6", "#0d9488"];

interface DashboardActivityChartProps {
  usage?: UsageMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardActivityChart({ usage, isLoading, error }: DashboardActivityChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const data = (usage?.byBot ?? [])
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 6)
    .map((bot) => ({
      name: bot.botName.length > 14 ? `${bot.botName.slice(0, 14)}…` : bot.botName,
      fullName: bot.botName,
      messages: bot.messages,
      conversations: bot.conversations,
    }));

  return (
    <DashboardWidgetCard
      title={t("dashboard.activityChartTitle")}
      subtitle={t("dashboard.activityChartSubtitle")}
      detailHref="/metrics"
      isLoading={isLoading}
      error={error}
      isEmpty={!isLoading && !error && data.length === 0}
      emptyTitle={t("dashboard.activityEmptyTitle")}
      emptyDescription={t("dashboard.activityEmptyDescription")}
      emptyIcon={<BotMessageSquare className="h-5 w-5" />}
    >
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--accent-muted)" }}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value, name) => [
                formatNumber(Number(value)),
                name === "messages" ? t("metrics.messages") : t("metrics.conversations"),
              ]}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullName ?? ""
              }
            />
            <Bar dataKey="messages" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}
