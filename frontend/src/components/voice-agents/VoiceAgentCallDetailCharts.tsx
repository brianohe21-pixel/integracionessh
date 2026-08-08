"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CostSlice } from "@/lib/voice-agent-call-visuals";
import {
  formatLatencyAxisTick,
  formatLatencyMs,
  isTurnLatencyChartCapped,
  TURN_LATENCY_CHART_CAP_MS,
  turnLatencyChartDisplayValue,
} from "@/lib/voice-agent-call-latency";

const tooltipStyle = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

export function CallCostDonutChart({
  slices,
  totalLabel,
}: {
  slices: CostSlice[];
  totalLabel: string;
}) {
  if (slices.length === 0) return null;

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={54}
            outerRadius={82}
            paddingAngle={2}
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
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
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-primary)"
            fontSize={11}
            fontWeight={600}
          >
            {totalLabel}
          </text>
          <text
            x="50%"
            y="58%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-secondary)"
            fontSize={12}
          >
            {formatUsd(total)}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CallLatencyBarChart({
  data,
  valueFormatter = formatLatencyMs,
}: {
  data: Array<{ key: string; label: string; value: number; color: string }>;
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) return null;

  return (
    <div className="h-48 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={48}
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatLatencyAxisTick(Number(value))}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [valueFormatter(Number(value)), ""]}
          />
          <Bar dataKey="value" maxBarSize={56} radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type TurnLatencyBarPoint = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export function CallTurnLatencyBarChart({
  data,
  cappedLabel,
}: {
  data: TurnLatencyBarPoint[];
  cappedLabel: string;
}) {
  if (data.length === 0) return null;

  const chartData = data.map((entry) => ({
    ...entry,
    displayValue: turnLatencyChartDisplayValue(entry.value),
    capped: isTurnLatencyChartCapped(entry.value),
  }));

  const chartWidth = Math.max(chartData.length * 40 + 56, 320);
  const yTicks = [0, 2500, 5000, 7500, TURN_LATENCY_CHART_CAP_MS];

  return (
    <div className="w-full overflow-x-auto">
      <BarChart
        width={chartWidth}
        height={220}
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        barCategoryGap="20%"
      >
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          width={48}
          domain={[0, TURN_LATENCY_CHART_CAP_MS]}
          ticks={yTicks}
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatLatencyAxisTick(Number(value))}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(_value, _name, item) => {
            const point = item.payload as (typeof chartData)[number];
            const formatted = formatLatencyMs(point.value);
            return [point.capped ? `${formatted} (${cappedLabel})` : formatted, ""];
          }}
        />
        <Bar dataKey="displayValue" maxBarSize={28} radius={[4, 4, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={entry.capped ? "#dc2626" : entry.color} />
          ))}
        </Bar>
      </BarChart>
    </div>
  );
}
