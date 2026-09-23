"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { WhatsAppUsageReport } from "@/types";

async function fetchWhatsAppUsageReport(
  range: MetricsDateRange,
  botId?: string
): Promise<WhatsAppUsageReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  return api.get<WhatsAppUsageReport>(`/metrics/whatsapp-usage?${params.toString()}`);
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
