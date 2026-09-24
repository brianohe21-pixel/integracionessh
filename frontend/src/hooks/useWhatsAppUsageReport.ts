"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { WhatsAppUsageReport } from "@/types";

function isWhatsAppUsageReport(data: unknown): data is WhatsAppUsageReport {
  if (!data || typeof data !== "object") return false;
  const report = data as WhatsAppUsageReport;
  return (
    typeof report.from === "string" &&
    typeof report.to === "string" &&
    Array.isArray(report.daily) &&
    Boolean(report.totals) &&
    typeof report.totals.apiOutbound === "number" &&
    typeof report.totals.appEcho === "number" &&
    typeof report.totals.inbound === "number"
  );
}

async function fetchWhatsAppUsageReport(
  range: MetricsDateRange,
  botId?: string
): Promise<WhatsAppUsageReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<WhatsAppUsageReport>(
    `/metrics/whatsapp-usage?${params.toString()}`
  );
  if (!isWhatsAppUsageReport(data)) {
    throw new Error("Invalid WhatsApp usage report response");
  }
  return data;
}

export function useWhatsAppUsageReport(
  range: MetricsDateRange | null,
  botId?: string,
  enabled = false
) {
  return useQuery({
    queryKey: [
      "reports",
      "whatsapp-usage",
      range?.from ?? "",
      range?.to ?? "",
      botId ?? "all",
    ],
    queryFn: () => fetchWhatsAppUsageReport(range!, botId),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}
