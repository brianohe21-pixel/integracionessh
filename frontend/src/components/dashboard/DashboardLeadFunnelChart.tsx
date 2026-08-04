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
import { UserPlus } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import type { LeadMetrics } from "@/types";

const LEAD_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#16a34a", "#94a3b8"];

interface DashboardLeadFunnelChartProps {
  leads?: LeadMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

export function DashboardLeadFunnelChart({
  leads,
  isLoading,
  error,
}: DashboardLeadFunnelChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const funnel = leads?.funnel;
  const data = funnel
    ? [
        { key: "new", label: t("leads.status_new"), value: funnel.new },
        { key: "contacted", label: t("leads.status_contacted"), value: funnel.contacted },
        { key: "qualified", label: t("leads.status_qualified"), value: funnel.qualified },
        { key: "converted", label: t("leads.status_converted"), value: funnel.converted },
        { key: "lost", label: t("leads.status_lost"), value: funnel.lost },
      ]
    : [];

  const isEmpty = data.every((d) => d.value === 0);

  return (
    <DashboardWidgetCard
      title={t("dashboard.leadFunnelTitle")}
      subtitle={t("dashboard.leadFunnelSubtitle")}
      detailHref="/leads"
      isLoading={isLoading}
      error={error}
      isEmpty={!isLoading && !error && isEmpty}
      emptyTitle={t("leads.emptyTitle")}
      emptyDescription={t("leads.emptyDescription")}
      emptyIcon={<UserPlus className="h-5 w-5" />}
    >
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
              allowDecimals={false}
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
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell key={entry.key} fill={LEAD_COLORS[index % LEAD_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}
