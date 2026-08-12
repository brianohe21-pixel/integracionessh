"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, Phone } from "lucide-react";
import { MetricsChartCard } from "@/components/metrics/MetricsChartCard";
import { metricsAxisTick, metricsTooltipStyle } from "@/components/metrics/chart-theme";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type {
  VoiceAgentCostSlice,
  VoiceAgentDailyPoint,
  VoiceAgentSeriesPoint,
} from "@/lib/voice-agent-summary-metrics";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface VoiceAgentSummaryChartsProps {
  isEmpty: boolean;
  dailySeries: VoiceAgentDailyPoint[];
  directionSeries: VoiceAgentSeriesPoint[];
  statusSeries: VoiceAgentSeriesPoint[];
  costSlices: VoiceAgentCostSlice[];
}

export function VoiceAgentSummaryCharts({
  isEmpty,
  dailySeries,
  directionSeries,
  statusSeries,
  costSlices,
}: VoiceAgentSummaryChartsProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <MetricsChartCard
        className="xl:col-span-2"
        title={t("voiceAgents.chartVolumeTitle")}
        subtitle={t("voiceAgents.chartVolumeSubtitle")}
        isEmpty={isEmpty}
        emptyTitle={t("voiceAgents.noCalls")}
        emptyDescription={t("voiceAgents.chartEmptyDescription")}
        emptyIcon={<BarChart3 className="h-5 w-5" />}
      >
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailySeries} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={metricsAxisTick} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="calls"
                tick={metricsAxisTick}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(value) => formatNumber(Number(value))}
              />
              <YAxis
                yAxisId="cost"
                orientation="right"
                tick={metricsAxisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
              />
              <Tooltip
                cursor={{ fill: "var(--accent-muted)" }}
                contentStyle={metricsTooltipStyle}
                formatter={(value, name) => {
                  if (name === "costUsd") {
                    return [formatUsd(Number(value)), t("voiceAgents.summaryCost")];
                  }
                  if (name === "completed") {
                    return [formatNumber(Number(value)), t("voiceAgents.summaryCompleted")];
                  }
                  return [formatNumber(Number(value)), t("voiceAgents.summaryCalls")];
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{value}</span>
                )}
              />
              <Bar
                yAxisId="calls"
                dataKey="calls"
                name={t("voiceAgents.summaryCalls")}
                fill="#128c7e"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                yAxisId="calls"
                dataKey="completed"
                name={t("voiceAgents.summaryCompleted")}
                fill="#2dd4bf"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Line
                yAxisId="cost"
                type="monotone"
                dataKey="costUsd"
                name={t("voiceAgents.summaryCost")}
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#8b5cf6" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </MetricsChartCard>

      <MetricsChartCard
        title={t("voiceAgents.chartDirectionTitle")}
        subtitle={t("voiceAgents.chartDirectionSubtitle")}
        isEmpty={directionSeries.length === 0}
        emptyTitle={t("voiceAgents.noCalls")}
        emptyDescription={t("voiceAgents.chartEmptyDescription")}
        emptyIcon={<Phone className="h-5 w-5" />}
      >
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={directionSeries}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={2}
              >
                {directionSeries.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={metricsTooltipStyle}
                formatter={(value, _name, item) => [
                  formatNumber(Number(value)),
                  String(item.payload.label),
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </MetricsChartCard>

      <MetricsChartCard
        title={t("voiceAgents.chartStatusTitle")}
        subtitle={t("voiceAgents.chartStatusSubtitle")}
        isEmpty={statusSeries.length === 0}
        emptyTitle={t("voiceAgents.noCalls")}
        emptyDescription={t("voiceAgents.chartEmptyDescription")}
        emptyIcon={<BarChart3 className="h-5 w-5" />}
      >
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={statusSeries}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                tick={metricsAxisTick}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(value) => formatNumber(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={96}
                tick={metricsAxisTick}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--accent-muted)" }}
                contentStyle={metricsTooltipStyle}
                formatter={(value) => [formatNumber(Number(value)), ""]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {statusSeries.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </MetricsChartCard>

      <MetricsChartCard
        className="xl:col-span-2"
        title={t("voiceAgents.chartCostTitle")}
        subtitle={t("voiceAgents.chartCostSubtitle")}
        isEmpty={costSlices.length === 0}
        emptyTitle={t("voiceAgents.chartCostEmpty")}
        emptyDescription={t("voiceAgents.chartEmptyDescription")}
        emptyIcon={<PieChartIcon className="h-5 w-5" />}
      >
        <div className="mx-auto h-72 w-full max-w-md min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={costSlices}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={96}
                paddingAngle={2}
              >
                {costSlices.map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={metricsTooltipStyle}
                formatter={(value, _name, item) => [
                  `${formatUsd(Number(value))} (${Number(item.payload.percent).toFixed(1)}%)`,
                  String(item.payload.label),
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </MetricsChartCard>
    </div>
  );
}
