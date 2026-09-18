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
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import type { Channel, UsageMetrics } from "@/types";

const CHART_COLORS = ["#128c7e", "#2dd4bf", "#0f766e", "#14b8a6", "#0d9488"];

interface DashboardMessagesSentChartProps {
  usage?: UsageMetrics | null;
  isLoading: boolean;
  error?: Error | null;
}

function getChannelLabel(channel: Channel, t: ReturnType<typeof useT>): string {
  if (channel === "instagram") return t("conversations.channelInstagram");
  if (channel === "webchat") return t("conversations.channelWebchat");
  if (channel === "telegram") return t("conversations.channelTelegram");
  if (channel === "messenger") return t("conversations.channelMessenger");
  if (channel === "sms") return t("conversations.channelSms");
  if (channel === "email") return t("conversations.channelEmail");
  if (channel === "voicebot") return t("conversations.channelVoicebot");
  if (channel === "phone") return t("conversations.channelPhone");
  return t("conversations.channelWhatsapp");
}

export function DashboardMessagesSentChart({
  usage,
  isLoading,
  error,
}: DashboardMessagesSentChartProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  const data = (usage?.byChannel ?? [])
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 6)
    .map((entry) => {
      const label = getChannelLabel(entry.channel, t);
      return {
        name: label.length > 14 ? `${label.slice(0, 14)}…` : label,
        fullName: label,
        messages: entry.messages,
      };
    });

  const isEmpty = !isLoading && !error && (usage?.summary.totalMessages ?? 0) === 0;

  return (
    <DashboardWidgetCard
      title={t("dashboard.messagesSentTitle")}
      subtitle={t("dashboard.messagesSentSubtitle", {
        total: formatNumber(usage?.summary.totalMessages ?? 0),
      })}
      detailHref="/metrics?section=usage"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle={t("dashboard.messagesSentEmptyTitle")}
      emptyDescription={t("dashboard.messagesSentEmptyDescription")}
      emptyIcon={<SendHorizonal className="h-5 w-5" />}
    >
      <div className="h-56 w-full min-w-0">
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
              formatter={(value) => [formatNumber(Number(value)), t("metrics.messages")]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
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
