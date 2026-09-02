"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  Clock3,
  DollarSign,
  PhoneCall,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { formatCallDuration } from "@/hooks/useCallingMetrics";
import { useTelephonyCalls } from "@/hooks/useTelephony";
import { useLocale, useT } from "@/i18n/context";
import {
  buildVoiceAgentAggregatedCostSlices,
  buildVoiceAgentDailySeries,
  buildVoiceAgentDirectionSeries,
  buildVoiceAgentStatusSeries,
  buildVoiceAgentSummaryStats,
} from "@/lib/voice-agent-summary-metrics";
import type { CallRecord } from "@/types";
import { cn } from "@/lib/utils";
import { VoiceAgentSummaryCharts } from "./VoiceAgentSummaryCharts";

interface VoiceAgentSummaryProps {
  botId: string;
  compact?: boolean;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function SummarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="content-card h-28 animate-pulse bg-surface-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="content-card h-80 animate-pulse bg-surface-muted xl:col-span-2" />
        <div className="content-card h-72 animate-pulse bg-surface-muted" />
        <div className="content-card h-72 animate-pulse bg-surface-muted" />
      </div>
    </div>
  );
}

export function VoiceAgentSummary({ botId, compact = false }: VoiceAgentSummaryProps) {
  const t = useT();
  const locale = useLocale();
  const intlLocale = locale === "en" ? "en-US" : "es-ES";
  const { data, isLoading } = useTelephonyCalls(botId);
  const calls = useMemo(() => data?.items ?? [], [data?.items]);

  const statusLabels = useMemo(
    () =>
      ({
        initiated: t("voiceAgents.callRecordStatus.initiated"),
        ringing: t("voiceAgents.callRecordStatus.ringing"),
        accepted: t("voiceAgents.callRecordStatus.accepted"),
        rejected: t("voiceAgents.callRecordStatus.rejected"),
        completed: t("voiceAgents.callRecordStatus.completed"),
        failed: t("voiceAgents.callRecordStatus.failed"),
        terminated: t("voiceAgents.callRecordStatus.terminated"),
        voicemail: t("voiceAgents.callRecordStatus.voicemail"),
      }) satisfies Record<CallRecord["status"], string>,
    [t]
  );

  const stats = useMemo(() => buildVoiceAgentSummaryStats(calls), [calls]);
  const dailySeries = useMemo(
    () => buildVoiceAgentDailySeries(calls, intlLocale),
    [calls, intlLocale]
  );
  const directionSeries = useMemo(
    () =>
      buildVoiceAgentDirectionSeries(calls, {
        inbound: t("voiceAgents.inbound"),
        outbound: t("voiceAgents.outbound"),
      }),
    [calls, t]
  );
  const statusSeries = useMemo(
    () => buildVoiceAgentStatusSeries(calls, statusLabels),
    [calls, statusLabels]
  );
  const costSlices = useMemo(
    () =>
      buildVoiceAgentAggregatedCostSlices(calls, {
        telephony: t("voiceAgents.telephonyCost"),
        platform: t("voiceAgents.platformCost"),
        ai: t("voiceAgents.aiCost"),
        voice: t("voiceAgents.voiceCost"),
        recording: t("voiceAgents.recordingCost"),
      }),
    [calls, t]
  );

  if (isLoading) {
    return <SummarySkeleton />;
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className={cn("grid gap-3", compact ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4")}>
        <StatCard
          compact={compact}
          label={t("voiceAgents.summaryCalls")}
          value={String(stats.totalCalls)}
          sub={t("voiceAgents.summaryCallsSub", {
            inbound: stats.inboundCalls,
            outbound: stats.outboundCalls,
          })}
          icon={<PhoneCall className="h-5 w-5 text-accent" />}
        />
        <StatCard
          compact={compact}
          label={t("voiceAgents.summaryCompleted")}
          value={String(stats.completedCalls)}
          sub={t("voiceAgents.summaryCompletionRate", { rate: stats.completionRate })}
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
        />
        <StatCard
          compact={compact}
          label={t("voiceAgents.summaryMinutes")}
          value={String(stats.totalMinutes)}
          sub={
            stats.avgDurationSeconds > 0
              ? t("voiceAgents.summaryAvgDuration", {
                  duration: formatCallDuration(stats.avgDurationSeconds),
                })
              : t("voiceAgents.summaryNoDuration")
          }
          icon={<Clock3 className="h-5 w-5 text-info" />}
        />
        <StatCard
          compact={compact}
          label={t("voiceAgents.summaryCost")}
          value={formatUsd(stats.totalCost)}
          sub={t("voiceAgents.summaryRecordings", { count: stats.recordingsReady })}
          icon={<DollarSign className="h-5 w-5 text-warning" />}
        />
      </div>

      {stats.totalCalls > 0 && stats.failedCalls > 0 ? (
        <div className="content-card flex items-start gap-3 border-warning/30 bg-warning/5 p-4">
          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-primary">{t("voiceAgents.summaryInsightTitle")}</p>
            <p className="mt-1 text-sm text-secondary">
              {t("voiceAgents.summaryInsightBody", {
                failed: stats.failedCalls,
                total: stats.totalCalls,
              })}
            </p>
          </div>
        </div>
      ) : null}

      <VoiceAgentSummaryCharts
        isEmpty={stats.totalCalls === 0}
        dailySeries={dailySeries}
        directionSeries={directionSeries}
        statusSeries={statusSeries}
        costSlices={costSlices}
      />
    </div>
  );
}
