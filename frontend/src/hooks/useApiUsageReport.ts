"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { ApiUsageReport } from "@/types";

function isApiUsageReport(data: unknown): data is ApiUsageReport {
  if (!data || typeof data !== "object") return false;
  const report = data as ApiUsageReport;
  return (
    typeof report.from === "string" &&
    typeof report.to === "string" &&
    typeof report.totals?.requests === "number" &&
    typeof report.totals?.success === "number" &&
    typeof report.totals?.error === "number" &&
    Array.isArray(report.daily) &&
    Array.isArray(report.byKey) &&
    Array.isArray(report.byEndpoint) &&
    Array.isArray(report.webhooks)
  );
}

async function fetchApiUsageReport(range: MetricsDateRange): Promise<ApiUsageReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  const data = await api.get<ApiUsageReport>(`/metrics/api-usage?${params.toString()}`);
  if (!isApiUsageReport(data)) {
    throw new Error("Invalid API usage report response");
  }
  return data;
}

export function useApiUsageReport(range: MetricsDateRange | null, enabled = false) {
  return useQuery({
    queryKey: ["reports", "api-usage", range?.from ?? "", range?.to ?? ""],
    queryFn: () => fetchApiUsageReport(range!),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}
