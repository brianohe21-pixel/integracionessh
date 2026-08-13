import { formatCallDuration } from "@/hooks/useCallingMetrics";
import { formatLatencyMs } from "@/lib/voice-agent-call-latency";
import type { CallEvent, CallEventType } from "@/types";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const KNOWN_MESSAGE_KEYS: Record<string, string> = {
  "Outbound call started": "voiceAgents.callEventMessage.outboundStarted",
  "Inbound call received": "voiceAgents.callEventMessage.inboundReceived",
  "Caller hung up before answer": "voiceAgents.callEventMessage.callerHungUpBeforeAnswer",
  "Recording start failed": "voiceAgents.callEventMessage.recordingStartFailed",
  "Recording URL missing": "voiceAgents.callEventMessage.recordingUrlMissing",
  "Recording storage failed": "voiceAgents.callEventMessage.recordingStorageFailed",
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

export function callEventTypeLabel(t: TranslateFn, type: CallEventType): string {
  return t(`voiceAgents.callEventType.${type}`);
}

export function formatCallEventDetails(t: TranslateFn, event: CallEvent): string | null {
  if (event.message) {
    const key = KNOWN_MESSAGE_KEYS[event.message];
    return key ? t(key) : event.message;
  }

  const metadata = event.metadata;
  if (!metadata) {
    if (event.type === "cost_pending") {
      return t("voiceAgents.callEventMessage.costPending");
    }
    return null;
  }

  if (event.type === "tool_executed") {
    const toolName =
      typeof metadata.toolName === "string" ? metadata.toolName : event.message ?? "tool";
    const latencyMs = typeof metadata.latencyMs === "number" ? metadata.latencyMs : 0;
    return t("voiceAgents.callEventMessage.toolExecuted", {
      toolName,
      latency: formatLatencyMs(latencyMs),
    });
  }

  if (event.type === "hangup" && typeof metadata.durationSeconds === "number") {
    return t("voiceAgents.callEventMessage.hangupDuration", {
      duration: formatCallDuration(metadata.durationSeconds),
    });
  }

  if (
    (event.type === "cost_finalized" || event.type === "cost_partial") &&
    typeof metadata.totalUsd === "number"
  ) {
    return t("voiceAgents.callEventMessage.costTotal", {
      amount: formatUsd(metadata.totalUsd),
    });
  }

  if (event.type === "recording_saved" && typeof metadata.sizeBytes === "number") {
    const sizeMb = (metadata.sizeBytes / (1024 * 1024)).toFixed(2);
    return t("voiceAgents.callEventMessage.recordingSize", { sizeMb });
  }

  return null;
}

export function formatCallEventDate(
  value: string,
  locale: "es" | "en"
): string {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
