"use client";

import {
  Activity,
  Clock,
  MessageSquareReply,
  UserCheck,
  Radio,
  Truck,
  XCircle,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { formatWaitTime, useCampaignMetrics } from "@/hooks/useCampaignMetrics";
import type { Campaign, Channel } from "@/types";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

const CHANNELS: Channel[] = [
  "whatsapp",
  "instagram",
  "webchat",
  "telegram",
  "messenger",
  "sms",
  "email",
  "voicebot",
];

const CHANNEL_COLORS: Record<Channel, { bar: string; text: string }> = {
  whatsapp: { bar: "bg-green-500", text: "text-green-700" },
  instagram: { bar: "bg-pink-500", text: "text-pink-700" },
  webchat: { bar: "bg-blue-500", text: "text-blue-700" },
  telegram: { bar: "bg-sky-500", text: "text-sky-700" },
  messenger: { bar: "bg-indigo-500", text: "text-indigo-700" },
  sms: { bar: "bg-amber-500", text: "text-amber-700" },
  email: { bar: "bg-violet-500", text: "text-violet-700" },
  voicebot: { bar: "bg-rose-500", text: "text-rose-700" },
};

interface CampaignRealtimeMetricsPanelProps {
  campaign: Campaign;
}

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-4 sm:p-5 min-w-0 overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-secondary uppercase tracking-wide leading-snug">
            {label}
          </p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted mt-1 leading-relaxed">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-center w-9 h-9 bg-accent-muted rounded-lg text-accent">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MetricsSkeleton({ kpiCount = 4 }: { kpiCount?: number }) {
  return (
    <div className="space-y-4">
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ${
          kpiCount > 4 ? "lg:grid-cols-3" : "lg:grid-cols-2 xl:grid-cols-4"
        }`}
      >
        {[...Array(kpiCount)].map((_, i) => (
          <div key={i} className="bg-surface-elevated rounded-xl border border-default p-5 animate-pulse h-24" />
        ))}
      </div>
      <div className="bg-surface-elevated rounded-xl border border-default p-5 animate-pulse h-32" />
    </div>
  );
}

export function CampaignRealtimeMetricsPanel({ campaign }: CampaignRealtimeMetricsPanelProps) {
  const t = useT();
  const { formatRelativeTime } = useFormatters();
  const campaignChannel = campaign.channel ?? "whatsapp";
  const isSms = campaignChannel === "sms";
  const showSmsDeliveryMetrics = isSms && Boolean(campaign.requestDlr);
  const { data: metrics, isLoading, error, dataUpdatedAt } = useCampaignMetrics(
    campaign.campaignId,
    campaign.status
  );

  if (campaign.status === "draft") return null;

  if (campaign.sent === 0 && !isLoading) {
    return (
      <div className="bg-surface-elevated rounded-xl border border-default p-5">
        <h2 className="font-semibold text-primary">{t("campaigns.realtimeMetrics.title")}</h2>
        <p className="text-sm text-secondary mt-2">{t("campaigns.realtimeMetrics.emptyNotSent")}</p>
      </div>
    );
  }

  if (isLoading && !metrics) {
    return <MetricsSkeleton kpiCount={showSmsDeliveryMetrics ? 6 : 4} />;
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-600">{t("campaigns.realtimeMetrics.loadError")}</p>
      </div>
    );
  }

  const totalConversions = CHANNELS.reduce(
    (sum, channel) => sum + (metrics.conversionsByChannel[channel] ?? 0),
    0
  );
  const activeChannels = CHANNELS.filter(
    (channel) => (metrics.conversionsByChannel[channel] ?? 0) > 0
  );
  const channelsToShow = isSms ? activeChannels : CHANNELS;
  const maxChannelConversions = Math.max(
    1,
    ...channelsToShow.map((channel) => metrics.conversionsByChannel[channel] ?? 0)
  );
  const deliveryRate = rate(campaign.deliveredCount, campaign.sent);
  const deliveryFailureRate = rate(campaign.deliveryFailed, campaign.sent);
  const subtitleKey = showSmsDeliveryMetrics
    ? "campaigns.realtimeMetrics.subtitleSmsDlr"
    : isSms
      ? "campaigns.realtimeMetrics.subtitleSms"
      : "campaigns.realtimeMetrics.subtitle";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-primary">{t("campaigns.realtimeMetrics.title")}</h2>
          <p className="text-sm text-secondary">{t(subtitleKey)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-secondary">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            <Radio className="w-3 h-3" />
            {t("campaigns.realtimeMetrics.live")}
          </span>
          {dataUpdatedAt > 0 && (
            <span className="text-muted">
              {t("campaigns.realtimeMetrics.updated", {
                time: formatRelativeTime(new Date(dataUpdatedAt).toISOString()),
              })}
            </span>
          )}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ${
          showSmsDeliveryMetrics ? "lg:grid-cols-3" : "lg:grid-cols-2 xl:grid-cols-4"
        }`}
      >
        {showSmsDeliveryMetrics && (
          <>
            <KpiCard
              label={t("campaigns.realtimeMetrics.deliveryRate")}
              value={`${deliveryRate}%`}
              sub={t("campaigns.realtimeMetrics.deliveryRateSub", {
                delivered: campaign.deliveredCount,
                sent: campaign.sent,
              })}
              icon={<Truck className="w-5 h-5" />}
            />
            <KpiCard
              label={t("campaigns.realtimeMetrics.deliveryFailureRate")}
              value={`${deliveryFailureRate}%`}
              sub={t("campaigns.realtimeMetrics.deliveryFailureRateSub", {
                failed: campaign.deliveryFailed,
                sent: campaign.sent,
              })}
              icon={<XCircle className="w-5 h-5" />}
            />
          </>
        )}
        <KpiCard
          label={t("campaigns.realtimeMetrics.replyRate")}
          value={`${metrics.replyRate}%`}
          sub={t("campaigns.realtimeMetrics.replyRateSub", {
            replied: metrics.funnel.replied,
            sent: metrics.funnel.sent,
          })}
          icon={<MessageSquareReply className="w-5 h-5" />}
        />
        <KpiCard
          label={t("campaigns.realtimeMetrics.advisorResponseRate")}
          value={`${metrics.advisorResponseRate}%`}
          sub={t("campaigns.realtimeMetrics.advisorResponseRateSub", {
            responded: metrics.funnel.advisorResponded,
            handoff: metrics.funnel.handoff,
          })}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <KpiCard
          label={t("campaigns.realtimeMetrics.waitTime")}
          value={formatWaitTime(metrics.averageWaitTimeSeconds)}
          sub={
            metrics.pendingWaitCount > 0
              ? t("campaigns.realtimeMetrics.pendingWait", { count: metrics.pendingWaitCount })
              : t("campaigns.realtimeMetrics.waitTimeSub")
          }
          icon={<Clock className="w-5 h-5" />}
        />
        <KpiCard
          label={t("campaigns.realtimeMetrics.conversions")}
          value={String(totalConversions)}
          sub={t("campaigns.realtimeMetrics.conversionsSub", {
            converted: metrics.funnel.converted,
            replied: metrics.funnel.replied,
          })}
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      <div className="bg-surface-elevated rounded-xl border border-default p-5 space-y-3">
        <h3 className="text-sm font-semibold text-primary">
          {t("campaigns.realtimeMetrics.conversionsByChannel")}
        </h3>
        {totalConversions === 0 ? (
          <p className="text-sm text-secondary">{t("campaigns.realtimeMetrics.noConversions")}</p>
        ) : (
          <div className="space-y-2">
            {channelsToShow.map((channel) => {
              const count = metrics.conversionsByChannel[channel] ?? 0;
              const pct = Math.round((count / maxChannelConversions) * 100);
              const colors = CHANNEL_COLORS[channel];
              return (
                <div key={channel} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${colors.text}`}>
                      {t(`campaigns.realtimeMetrics.channels.${channel}`)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {count.toLocaleString()}
                      <span className="text-xs text-muted ml-1">
                        ({metrics.funnel.replied > 0
                          ? Math.round((count / metrics.funnel.replied) * 100)
                          : 0}
                        %)
                      </span>
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
