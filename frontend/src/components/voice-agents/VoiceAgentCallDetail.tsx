"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, User, X } from "lucide-react";
import { AudioWaveformPlayer } from "@/components/ui/AudioWaveformPlayer";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { CallCostDonutChart, CallLatencyBarChart, CallTurnLatencyBarChart } from "@/components/voice-agents/VoiceAgentCallDetailCharts";
import { formatCallDuration } from "@/hooks/useCallingMetrics";
import {
  useTelephonyCall,
  useTelephonyCallEvents,
  useTelephonyCallTranscript,
  useTelephonyRecording,
} from "@/hooks/useTelephony";
import { useT, useLocale } from "@/i18n/context";
import {
  buildCallLatencySummary,
  formatLatencyMs,
} from "@/lib/voice-agent-call-latency";
import {
  buildCostSlices,
  buildSetupLatencyChart,
  buildTurnLatencyChart,
  costStatusVariant,
  eventVariant,
  latencyQuality,
  latencyVariant,
  recordingStatusVariant,
  statusVariant,
} from "@/lib/voice-agent-call-visuals";
import {
  callEventTypeLabel,
  formatCallEventDate,
  formatCallEventDetails,
} from "@/lib/voice-agent-call-events";
import { cn } from "@/lib/utils";
import type { CallRecord } from "@/types";

interface VoiceAgentCallDetailProps {
  botId: string;
  call: CallRecord | null;
  open: boolean;
  onClose: () => void;
}

type CallDetailTab = "summary" | "costs" | "latency" | "timeline";

function formatUsd(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

function latencyQualityLabel(
  t: (key: string) => string,
  ms: number
): string {
  const quality = latencyQuality(ms);
  if (quality === "fast") return t("voiceAgents.latencyFast");
  if (quality === "medium") return t("voiceAgents.latencyMedium");
  return t("voiceAgents.latencySlow");
}

export function VoiceAgentCallDetail({ botId, call: previewCall, open, onClose }: VoiceAgentCallDetailProps) {
  const t = useT();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<CallDetailTab>("summary");
  const callId = previewCall?.callId;
  const { data: detailCall } = useTelephonyCall(botId, callId);
  const call = detailCall ?? previewCall;
  const { data: eventsData, isLoading: eventsLoading } = useTelephonyCallEvents(botId, callId);
  const { data: messages, isLoading: transcriptLoading } = useTelephonyCallTranscript(
    call?.conversationId,
    call?.status
  );
  const recordingEnabled = call?.recordingStatus === "ready";
  const { data: recording } = useTelephonyRecording(botId, callId, recordingEnabled);

  const events = eventsData?.items ?? [];
  const breakdown = call?.costBreakdown;
  const transcript = (messages ?? []).filter(
    (message) => message.role === "user" || message.role === "assistant"
  );
  const latency = buildCallLatencySummary({
    events,
    messages: transcript,
    durationSeconds: call?.duration,
  });

  const costSlices = useMemo(
    () =>
      breakdown
        ? buildCostSlices(breakdown, {
            telephony: t("voiceAgents.telephonyCost"),
            platform: t("voiceAgents.platformCost"),
            ai: t("voiceAgents.aiCost"),
            voice: t("voiceAgents.voiceCost"),
            recording: t("voiceAgents.recordingCost"),
          })
        : [],
    [breakdown, t]
  );

  const setupLatencyChart = useMemo(
    () =>
      buildSetupLatencyChart(latency).map((item) => ({
        ...item,
        label:
          item.labelKey === "latencyRing"
            ? t("voiceAgents.latencyRing")
            : item.labelKey === "latencyAnswer"
              ? t("voiceAgents.latencyAnswer")
              : t("voiceAgents.latencyTalk"),
      })),
    [latency, t]
  );

  const turnLatencyChart = useMemo(() => buildTurnLatencyChart(latency.turns), [latency.turns]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) setActiveTab("summary");
  }, [open, callId]);

  if (!mounted || !open || !call) return null;

  const tabs = [
    { id: "summary" as const, label: t("voiceAgents.callDetailTabSummary") },
    { id: "costs" as const, label: t("voiceAgents.callDetailTabCosts") },
    { id: "latency" as const, label: t("voiceAgents.callDetailTabLatency") },
    { id: "timeline" as const, label: t("voiceAgents.eventTimeline"), count: events.length },
  ];

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-1/2 min-w-0 flex-col border-l border-default bg-surface-elevated shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-default px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-primary">{t("voiceAgents.callDetailTitle")}</h3>
            <p className="text-sm text-secondary">{call.phoneNumber}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={statusVariant(call.status)} dot>
                {call.status}
              </Badge>
              <Badge variant="info" dot>
                {call.direction === "USER_INITIATED"
                  ? t("voiceAgents.inbound")
                  : t("voiceAgents.outbound")}
              </Badge>
              <Badge variant={costStatusVariant(call.costStatus)} dot>
                {call.costStatus ?? "pending"}
              </Badge>
              <Badge variant={recordingStatusVariant(call.recordingStatus)} dot>
                {call.recordingStatus ?? "disabled"}
              </Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-secondary hover:bg-surface-muted hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-default px-5 py-3">
          <Tabs items={tabs} value={activeTab} onChange={setActiveTab} className="w-full" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              activeTab !== "summary" && "hidden"
            )}
          >
            <div className="shrink-0 space-y-4">
              <div className="rounded-xl border border-default bg-surface p-3">
                <p className="text-xs text-secondary">{t("voiceAgents.colDuration")}</p>
                <p className="mt-1 text-lg font-semibold text-primary">
                  {call.duration ? formatCallDuration(call.duration) : "—"}
                </p>
              </div>

              {recording?.url && (
                <div className="rounded-xl border border-default bg-surface p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-primary">
                      {t("voiceAgents.playRecording")}
                    </h4>
                    <Badge variant="success" dot>
                      {t("voiceAgents.recordingReady")}
                    </Badge>
                  </div>
                  <AudioWaveformPlayer src={recording.url} />
                </div>
              )}
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
              <h4 className="mb-2 shrink-0 text-sm font-semibold text-primary">
                {t("voiceAgents.transcriptTitle")}
              </h4>
              <div className="min-h-48 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-default bg-surface p-3">
                {transcriptLoading ? (
                  <p className="text-sm text-secondary">{t("common.loading")}</p>
                ) : transcript.length === 0 ? (
                  <p className="text-sm text-secondary">{t("voiceAgents.noTranscript")}</p>
                ) : (
                  <ul className="space-y-3">
                    {transcript.map((message) => {
                      const isUser = message.role === "user";
                      return (
                        <li
                          key={message.messageId}
                          className={`flex items-end gap-2 ${isUser ? "justify-start" : "justify-end"}`}
                        >
                          {isUser && (
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                              <User className="h-3.5 w-3.5 text-blue-500" />
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                              isUser
                                ? "rounded-bl-sm border border-blue-500/20 bg-blue-500/10 text-primary"
                                : "rounded-br-sm border border-accent/30 bg-accent-muted text-primary"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant={isUser ? "info" : "accent"}>
                                {isUser
                                  ? t("voiceAgents.transcriptUser")
                                  : t("voiceAgents.transcriptAssistant")}
                              </Badge>
                            </div>
                            <p className="leading-relaxed">{message.content}</p>
                            <p className="mt-1 text-[10px] text-secondary">
                              {new Date(message.timestamp).toLocaleString()}
                            </p>
                          </div>
                          {!isUser && (
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/10">
                              <Bot className="h-3.5 w-3.5 text-accent" />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 space-y-4 overflow-y-auto",
              activeTab !== "costs" && "hidden"
            )}
          >
              <div className="rounded-xl border border-default bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-secondary">{t("voiceAgents.colCost")}</p>
                    <p className="mt-1 text-2xl font-semibold text-primary">
                      {formatUsd(breakdown?.totalUsd)}
                    </p>
                  </div>
                  <Badge variant={costStatusVariant(call.costStatus)} dot>
                    {call.costStatus ?? "pending"}
                  </Badge>
                </div>
              </div>

              {breakdown ? (
                <>
                  <div className="rounded-xl border border-default bg-surface p-4">
                    <h4 className="text-sm font-semibold text-primary">{t("voiceAgents.costBreakdown")}</h4>
                    <CallCostDonutChart
                      slices={costSlices}
                      totalLabel={t("voiceAgents.colCost")}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {costSlices.map((slice) => (
                        <span
                          key={slice.key}
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-default"
                          style={{
                            backgroundColor: `${slice.color}18`,
                            color: slice.color,
                          }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          {slice.label}: {formatUsd(slice.value)} ({slice.percent.toFixed(1)}%)
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {costSlices.map((slice) => (
                      <div
                        key={slice.key}
                        className="rounded-xl border border-default bg-surface p-3"
                        style={{ borderColor: `${slice.color}40` }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          <p className="text-xs text-secondary">{slice.label}</p>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-primary">
                          {formatUsd(slice.value)}
                        </p>
                        <Badge
                          className="mt-2"
                          variant={
                            slice.percent >= 40
                              ? "warning"
                              : slice.percent >= 20
                                ? "info"
                                : "default"
                          }
                        >
                          {slice.percent.toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-secondary">{t("voiceAgents.noCostData")}</p>
              )}
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 space-y-5 overflow-y-auto",
              activeTab !== "latency" && "hidden"
            )}
          >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t("voiceAgents.latencyRing"), value: latency.ringMs },
                  { label: t("voiceAgents.latencyAnswer"), value: latency.answerMs },
                  { label: t("voiceAgents.latencyAvgResponse"), value: latency.avgResponseMs },
                  { label: t("voiceAgents.latencyMaxResponse"), value: latency.maxResponseMs },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-default bg-surface p-3"
                  >
                    <p className="text-xs text-secondary">{metric.label}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-primary">
                        {formatLatencyMs(metric.value)}
                      </p>
                      {metric.value !== null && metric.value !== undefined ? (
                        <Badge variant={latencyVariant(metric.value)} dot>
                          {latencyQualityLabel(t, metric.value)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {setupLatencyChart.length > 0 && (
                <div className="rounded-xl border border-default bg-surface p-4">
                  <h4 className="mb-2 text-sm font-semibold text-primary">
                    {t("voiceAgents.latencySetupChartTitle")}
                  </h4>
                  <CallLatencyBarChart data={setupLatencyChart} />
                </div>
              )}

              <div className="rounded-xl border border-default bg-surface p-4">
                <h4 className="mb-2 text-sm font-semibold text-primary">
                  {t("voiceAgents.latencyTurnsChartTitle")}
                </h4>
                {transcriptLoading ? (
                  <p className="text-sm text-secondary">{t("common.loading")}</p>
                ) : turnLatencyChart.length === 0 ? (
                  <p className="text-sm text-secondary">{t("voiceAgents.latencyNoTurns")}</p>
                ) : (
                  <>
                    <CallTurnLatencyBarChart
                      data={turnLatencyChart}
                      cappedLabel={t("voiceAgents.latencyChartCapped")}
                    />
                    <ul className="mt-3 space-y-2">
                      {latency.turns.map((turn, index) => (
                        <li
                          key={`${turn.userAt}-${turn.assistantAt}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-subtle px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="accent">
                              {t("voiceAgents.latencyTurnLabel", { index: index + 1 })}
                            </Badge>
                            <Badge variant={latencyVariant(turn.latencyMs)} dot>
                              {latencyQualityLabel(t, turn.latencyMs)}
                            </Badge>
                          </div>
                          <span className="font-medium text-primary">
                            {formatLatencyMs(turn.latencyMs)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
          </div>

          <div
            className={cn("min-h-0 flex-1 overflow-y-auto", activeTab !== "timeline" && "hidden")}
          >
              {eventsLoading ? (
                <p className="text-sm text-secondary">{t("common.loading")}</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-secondary">{t("voiceAgents.noEvents")}</p>
              ) : (
                <ul className="space-y-3">
                  {events.map((event, index) => {
                    const eventDetails = formatCallEventDetails(t, event);

                    return (
                    <li key={event.eventId} className="relative pl-6">
                      {index < events.length - 1 && (
                        <span className="absolute left-[7px] top-5 h-[calc(100%+0.5rem)] w-px bg-default" />
                      )}
                      <span
                        className={cn(
                          "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface-elevated",
                          eventVariant(event.type) === "success" && "bg-success",
                          eventVariant(event.type) === "warning" && "bg-warning",
                          eventVariant(event.type) === "danger" && "bg-danger",
                          eventVariant(event.type) === "info" && "bg-info",
                          eventVariant(event.type) === "accent" && "bg-accent"
                        )}
                      />
                      <div className="rounded-xl border border-default bg-surface px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant={eventVariant(event.type)} dot>
                            {callEventTypeLabel(t, event.type)}
                          </Badge>
                          <span className="text-xs text-secondary">
                            {formatCallEventDate(event.createdAt, locale)}
                          </span>
                        </div>
                        {eventDetails && (
                          <p className="mt-2 text-sm text-secondary">{eventDetails}</p>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
