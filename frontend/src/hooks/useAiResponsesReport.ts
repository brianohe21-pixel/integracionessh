"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { AiResponsesReport } from "@/types";

function isAiResponsesReport(data: unknown): data is AiResponsesReport {
  if (!data || typeof data !== "object") return false;
  const report = data as AiResponsesReport;
  return (
    typeof report.from === "string" &&
    typeof report.to === "string" &&
    Boolean(report.quota) &&
    typeof report.quota.totalUsed === "number" &&
    Array.isArray(report.daily) &&
    Array.isArray(report.byBot) &&
    Array.isArray(report.periods) &&
    Boolean(report.totals) &&
    typeof report.totals.responses === "number"
  );
}

async function fetchAiResponsesReport(
  range: MetricsDateRange,
  botId?: string
): Promise<AiResponsesReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<AiResponsesReport>(
    `/metrics/ai-responses?${params.toString()}`
  );
  if (!isAiResponsesReport(data)) {
    throw new Error("Invalid AI responses report response");
  }
  return data;
}

export function useAiResponsesReport(
  range: MetricsDateRange | null,
  botId?: string,
  enabled = false
) {
  return useQuery({
    queryKey: [
      "reports",
      "ai-responses",
      range?.from ?? "",
      range?.to ?? "",
      botId ?? "all",
    ],
    queryFn: () => fetchAiResponsesReport(range!, botId),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}
