"use client";

import { useState } from "react";
import {
  ChevronRight,
  Loader2,
  Mic,
  MicOff,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { formatCallDuration } from "@/hooks/useCallingMetrics";
import { useTelephonyCalls } from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import {
  costStatusVariant,
  recordingStatusVariant,
  statusVariant,
} from "@/lib/voice-agent-call-visuals";
import { cn } from "@/lib/utils";
import type { CallCostStatus, CallRecord, CallRecordStatus, CallRecordingStatus } from "@/types";
import { VoiceAgentCallDetail } from "./VoiceAgentCallDetail";

function formatUsd(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

function formatCallDate(value: string): { date: string; time: string } {
  const parsed = new Date(value);
  return {
    date: parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function callStatusLabel(t: (key: string) => string, status: CallRecordStatus): string {
  return t(`voiceAgents.callRecordStatus.${status}`);
}

function costStatusLabel(t: (key: string) => string, status: CallCostStatus): string {
  return t(`voiceAgents.costStatusLabel.${status}`);
}

function recordingStatusLabel(
  t: (key: string) => string,
  status?: CallRecordingStatus
): string {
  if (!status || status === "disabled") return "—";
  return t(`voiceAgents.recordingStatusLabel.${status}`);
}

interface VoiceAgentCallsTableProps {
  botId: string;
}

export function VoiceAgentCallsTable({ botId }: VoiceAgentCallsTableProps) {
  const t = useT();
  const { data, isLoading } = useTelephonyCalls(botId);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const calls = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-52 animate-pulse rounded bg-surface-muted" />
        <div className="h-4 w-80 animate-pulse rounded bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.callsTitle")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("voiceAgents.callsSubtitle")}</p>
      </div>

      {calls.length === 0 ? (
        <div className="content-card flex flex-col items-center justify-center px-6 py-14 text-center">
          <PhoneOutgoing className="mb-3 h-8 w-8 text-secondary" />
          <p className="text-sm font-medium text-primary">{t("voiceAgents.noCalls")}</p>
        </div>
      ) : (
        <DataTable minWidth="920px">
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("voiceAgents.colDate")}</DataTableCell>
              <DataTableCell header>{t("voiceAgents.colDirection")}</DataTableCell>
              <DataTableCell header>{t("voiceAgents.colNumber")}</DataTableCell>
              <DataTableCell header>{t("voiceAgents.colStatus")}</DataTableCell>
              <DataTableCell header className="text-right">
                {t("voiceAgents.colDuration")}
              </DataTableCell>
              <DataTableCell header className="text-right">
                {t("voiceAgents.colCost")}
              </DataTableCell>
              <DataTableCell header>{t("voiceAgents.colRecording")}</DataTableCell>
              <DataTableCell header className="w-10">{""}</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {calls.map((call) => {
              const isSelected = selectedCall?.callId === call.callId;
              const isInbound = call.direction === "USER_INITIATED";
              const startedAt = call.startedAt ?? call.createdAt;
              const { date, time } = formatCallDate(startedAt);

              return (
                <DataTableRow
                  key={call.callId}
                  className={cn(
                    "group cursor-pointer",
                    isSelected && "bg-accent/5 hover:bg-accent/8"
                  )}
                  onClick={() => setSelectedCall(call)}
                >
                  <DataTableCell>
                    <div className="min-w-[7.5rem]">
                      <p className="font-medium text-primary">{date}</p>
                      <p className="text-xs tabular-nums text-secondary">{time}</p>
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium",
                        isInbound ? "bg-info/10 text-info" : "bg-accent/10 text-accent"
                      )}
                    >
                      {isInbound ? (
                        <PhoneIncoming className="h-3.5 w-3.5" />
                      ) : (
                        <PhoneOutgoing className="h-3.5 w-3.5" />
                      )}
                      {isInbound ? t("voiceAgents.inbound") : t("voiceAgents.outbound")}
                    </span>
                  </DataTableCell>

                  <DataTableCell>
                    <span className="font-mono text-xs text-primary">{call.phoneNumber}</span>
                  </DataTableCell>

                  <DataTableCell>
                    <Badge variant={statusVariant(call.status)} dot>
                      {callStatusLabel(t, call.status)}
                    </Badge>
                  </DataTableCell>

                  <DataTableCell className="text-right tabular-nums font-medium text-primary">
                    {call.duration ? formatCallDuration(call.duration) : "—"}
                  </DataTableCell>

                  <DataTableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="tabular-nums font-semibold text-primary">
                        {formatUsd(call.costBreakdown?.totalUsd)}
                      </span>
                      {call.costStatus ? (
                        <Badge variant={costStatusVariant(call.costStatus)} className="text-[10px]">
                          {costStatusLabel(t, call.costStatus)}
                        </Badge>
                      ) : null}
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    {call.recordingStatus === "ready" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mic className="h-3.5 w-3.5 text-success" />
                        <Badge variant={recordingStatusVariant(call.recordingStatus)} dot>
                          {recordingStatusLabel(t, call.recordingStatus)}
                        </Badge>
                      </span>
                    ) : call.recordingStatus === "processing" ||
                      call.recordingStatus === "pending" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
                        <Badge variant={recordingStatusVariant(call.recordingStatus)} dot>
                          {recordingStatusLabel(t, call.recordingStatus)}
                        </Badge>
                      </span>
                    ) : call.recordingStatus === "failed" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MicOff className="h-3.5 w-3.5 text-danger" />
                        <Badge variant={recordingStatusVariant(call.recordingStatus)} dot>
                          {recordingStatusLabel(t, call.recordingStatus)}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-xs text-secondary">—</span>
                    )}
                  </DataTableCell>

                  <DataTableCell className="text-right">
                    <ChevronRight
                      className={cn(
                        "ml-auto h-4 w-4 text-secondary transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    />
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}

      <VoiceAgentCallDetail
        botId={botId}
        call={selectedCall}
        open={selectedCall !== null}
        onClose={() => setSelectedCall(null)}
      />
    </div>
  );
}
