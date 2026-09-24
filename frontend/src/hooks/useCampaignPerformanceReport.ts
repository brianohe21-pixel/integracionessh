"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { CampaignPerformanceReport } from "@/types";

function isCampaignPerformanceReport(
  data: unknown
): data is CampaignPerformanceReport {
  if (!data || typeof data !== "object") return false;
  const report = data as CampaignPerformanceReport;
  return (
    typeof report.from === "string" &&
    typeof report.to === "string" &&
    Array.isArray(report.campaigns) &&
    Array.isArray(report.byTemplate) &&
    Boolean(report.totals) &&
    typeof report.totals.sent === "number" &&
    typeof report.totals.delivered === "number"
  );
}

async function fetchCampaignPerformanceReport(
  range: MetricsDateRange,
  botId?: string
): Promise<CampaignPerformanceReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<CampaignPerformanceReport>(
    `/metrics/campaign-performance?${params.toString()}`
  );
  if (!isCampaignPerformanceReport(data)) {
    throw new Error("Invalid campaign performance report response");
  }
  return data;
}

export function useCampaignPerformanceReport(
  range: MetricsDateRange | null,
  botId?: string,
  enabled = false
) {
  return useQuery({
    queryKey: [
      "reports",
      "campaign-performance",
      range?.from ?? "",
      range?.to ?? "",
      botId ?? "all",
    ],
    queryFn: () => fetchCampaignPerformanceReport(range!, botId),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}
