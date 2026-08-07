"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";
import { formatCallDuration } from "@/hooks/useCallingMetrics";
import { useTelephonyCalls } from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import type { CallRecord } from "@/types";
import { VoiceAgentCallDetail } from "./VoiceAgentCallDetail";

function formatUsd(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

function statusVariant(status: CallRecord["status"]) {
  if (status === "completed" || status === "accepted") return "success";
  if (status === "failed" || status === "rejected" || status === "terminated") return "danger";
  return "default";
}

interface VoiceAgentCallsTableProps {
  botId: string;
}

export function VoiceAgentCallsTable({ botId }: VoiceAgentCallsTableProps) {
  const t = useT();
  const { data, isLoading } = useTelephonyCalls(botId);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const calls = data?.items ?? [];

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="content-card p-6">
        <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.callsTitle")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("voiceAgents.callsSubtitle")}</p>

        {calls.length === 0 ? (
          <p className="mt-4 text-sm text-secondary">{t("voiceAgents.noCalls")}</p>
        ) : (
          <TableContainer className="mt-4">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-default text-left text-secondary">
                  <th className="py-2 pr-4">{t("voiceAgents.colDate")}</th>
                  <th className="py-2 pr-4">{t("voiceAgents.colDirection")}</th>
                  <th className="py-2 pr-4">{t("voiceAgents.colNumber")}</th>
                  <th className="py-2 pr-4">{t("voiceAgents.colStatus")}</th>
                  <th className="py-2 pr-4">{t("voiceAgents.colDuration")}</th>
                  <th className="py-2 pr-4">{t("voiceAgents.colCost")}</th>
                  <th className="py-2">{t("voiceAgents.colRecording")}</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr
                    key={call.callId}
                    className="cursor-pointer border-b border-subtle hover:bg-surface-muted/60"
                    onClick={() => setSelectedCallId(call.callId)}
                  >
                    <td className="py-2 pr-4 text-secondary">
                      {new Date(call.startedAt ?? call.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      {call.direction === "USER_INITIATED"
                        ? t("voiceAgents.inbound")
                        : t("voiceAgents.outbound")}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{call.phoneNumber}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={statusVariant(call.status)}>{call.status}</Badge>
                    </td>
                    <td className="py-2 pr-4">
                      {call.duration ? formatCallDuration(call.duration) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {formatUsd(call.costBreakdown?.totalUsd)}
                      {call.costStatus && (
                        <span className="ml-1 text-xs text-secondary">({call.costStatus})</span>
                      )}
                    </td>
                    <td className="py-2">
                      {call.recordingStatus === "ready"
                        ? t("voiceAgents.recordingReady")
                        : call.recordingStatus === "processing"
                          ? t("voiceAgents.recordingProcessing")
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </div>

      {selectedCallId && (
        <VoiceAgentCallDetail
          botId={botId}
          callId={selectedCallId}
          onClose={() => setSelectedCallId(null)}
        />
      )}
    </div>
  );
}
