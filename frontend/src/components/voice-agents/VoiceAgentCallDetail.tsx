"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCallDuration } from "@/hooks/useCallingMetrics";
import {
  useTelephonyCall,
  useTelephonyCallEvents,
  useTelephonyRecording,
} from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";

interface VoiceAgentCallDetailProps {
  botId: string;
  callId: string;
  onClose: () => void;
}

function formatUsd(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

export function VoiceAgentCallDetail({ botId, callId, onClose }: VoiceAgentCallDetailProps) {
  const t = useT();
  const { data: call } = useTelephonyCall(botId, callId);
  const { data: eventsData } = useTelephonyCallEvents(botId, callId);
  const recordingEnabled = call?.recordingStatus === "ready";
  const { data: recording } = useTelephonyRecording(botId, callId, recordingEnabled);

  if (!call) return null;

  const events = eventsData?.items ?? [];
  const breakdown = call.costBreakdown;

  return (
    <div className="content-card space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">{t("voiceAgents.callDetailTitle")}</h3>
          <p className="text-sm text-secondary">{call.phoneNumber}</p>
        </div>
        <button type="button" onClick={onClose} className="text-secondary hover:text-primary">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <p className="text-xs text-secondary">{t("voiceAgents.colStatus")}</p>
          <Badge>{call.status}</Badge>
        </div>
        <div>
          <p className="text-xs text-secondary">{t("voiceAgents.colDuration")}</p>
          <p className="font-medium text-primary">
            {call.duration ? formatCallDuration(call.duration) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-secondary">{t("voiceAgents.colCost")}</p>
          <p className="font-medium text-primary">
            {formatUsd(breakdown?.totalUsd)} ({call.costStatus ?? "pending"})
          </p>
        </div>
        <div>
          <p className="text-xs text-secondary">{t("voiceAgents.colRecording")}</p>
          <p className="font-medium text-primary">{call.recordingStatus ?? "disabled"}</p>
        </div>
      </div>

      {breakdown && (
        <div className="rounded-xl border border-default bg-surface p-4">
          <h4 className="text-sm font-semibold text-primary">{t("voiceAgents.costBreakdown")}</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div>Telnyx: {formatUsd(breakdown.telnyxUsd)}</div>
            <div>OpenAI: {formatUsd(breakdown.openaiUsd)}</div>
            <div>ElevenLabs: {formatUsd(breakdown.elevenlabsUsd)}</div>
            <div>{t("voiceAgents.recordingCost")}: {formatUsd(breakdown.recordingUsd)}</div>
          </div>
        </div>
      )}

      {recording?.url && (
        <div className="rounded-xl border border-default bg-surface p-4">
          <h4 className="mb-2 text-sm font-semibold text-primary">{t("voiceAgents.playRecording")}</h4>
          <audio controls src={recording.url} className="w-full" />
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-primary">{t("voiceAgents.eventTimeline")}</h4>
        {events.length === 0 ? (
          <p className="text-sm text-secondary">{t("voiceAgents.noEvents")}</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.eventId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-subtle px-3 py-2 text-sm"
              >
                <span className="font-medium text-primary">{event.type}</span>
                <span className="text-secondary">{new Date(event.createdAt).toLocaleString()}</span>
                {event.message && <span className="w-full text-secondary">{event.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
