"use client";

import { useMemo } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { useTelephonyCalls } from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";

interface VoiceAgentSummaryProps {
  botId: string;
}

export function VoiceAgentSummary({ botId }: VoiceAgentSummaryProps) {
  const t = useT();
  const { data } = useTelephonyCalls(botId);
  const calls = data?.items ?? [];

  const summary = useMemo(() => {
    const completed = calls.filter((call) => call.status === "completed");
    const totalDuration = completed.reduce((sum, call) => sum + (call.duration ?? 0), 0);
    const totalCost = completed.reduce(
      (sum, call) => sum + (call.costBreakdown?.totalUsd ?? 0),
      0
    );
    const recordings = calls.filter((call) => call.recordingStatus === "ready").length;
    return {
      totalCalls: calls.length,
      completedCalls: completed.length,
      totalMinutes: Math.ceil(totalDuration / 60),
      totalCost,
      recordings,
    };
  }, [calls]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t("voiceAgents.summaryCalls")} value={String(summary.totalCalls)} />
      <StatCard label={t("voiceAgents.summaryCompleted")} value={String(summary.completedCalls)} />
      <StatCard label={t("voiceAgents.summaryMinutes")} value={String(summary.totalMinutes)} />
      <StatCard
        label={t("voiceAgents.summaryCost")}
        value={new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(summary.totalCost)}
      />
    </div>
  );
}
