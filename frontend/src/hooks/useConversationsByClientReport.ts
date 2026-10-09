"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { ConversationsByClientReport } from "@/types";

function isConversationsByClientReport(data: unknown): data is ConversationsByClientReport {
  if (!data || typeof data !== "object") return false;
  const report = data as ConversationsByClientReport;
  return (
    typeof report.from === "string" &&
    typeof report.to === "string" &&
    typeof report.serviceMessagesQuota === "number" &&
    Array.isArray(report.rows) &&
    Boolean(report.totals) &&
    typeof report.totals.conversations === "number" &&
    typeof report.totals.aiUsage === "number" &&
    typeof report.totals.serviceMessagesUsed === "number" &&
    typeof report.totals.inbound === "number" &&
    typeof report.totals.outbound === "number"
  );
}

async function fetchConversationsByClientReport(
  range: MetricsDateRange,
  botId?: string
): Promise<ConversationsByClientReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<ConversationsByClientReport>(
    `/metrics/conversations-by-client?${params.toString()}`
  );
  if (!isConversationsByClientReport(data)) {
    throw new Error("Invalid conversations by client report response");
  }
  return data;
}

export function useConversationsByClientReport(
  range: MetricsDateRange | null,
  botId?: string,
  enabled = false
) {
  return useQuery({
    queryKey: [
      "reports",
      "conversations-by-client",
      range?.from ?? "",
      range?.to ?? "",
      botId ?? "all",
    ],
    queryFn: () => fetchConversationsByClientReport(range!, botId),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}
