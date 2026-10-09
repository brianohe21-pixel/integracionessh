"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { MessageWindowReport } from "@/types";

const COUNT_KEYS = [
  "inboundService24h",
  "outboundService24h",
  "inboundFreeEntry72h",
  "outboundFreeEntry72h",
  "inboundOutsideWindow",
  "outboundOutsideWindow",
] as const;

function isMessageWindowReport(data: unknown): data is MessageWindowReport {
  if (!data || typeof data !== "object") return false;
  const report = data as MessageWindowReport;
  return (
    typeof report.from === "string" &&
    typeof report.to === "string" &&
    Array.isArray(report.daily) &&
    Boolean(report.totals) &&
    COUNT_KEYS.every((key) => typeof report.totals[key] === "number")
  );
}

async function fetchMessageWindowReport(
  range: MetricsDateRange,
  botId?: string
): Promise<MessageWindowReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<MessageWindowReport>(
    `/metrics/message-windows?${params.toString()}`
  );
  if (!isMessageWindowReport(data)) {
    throw new Error("Invalid message window report response");
  }
  return data;
}

export function useMessageWindowReport(
  range: MetricsDateRange | null,
  botId?: string,
  enabled = false
) {
  return useQuery({
    queryKey: [
      "reports",
      "message-windows",
      range?.from ?? "",
      range?.to ?? "",
      botId ?? "all",
    ],
    queryFn: () => fetchMessageWindowReport(range!, botId),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}
