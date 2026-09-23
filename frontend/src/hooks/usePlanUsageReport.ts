"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { BillingUsageResponse, MonthlyUsage } from "@/types";

function isPlanUsageReport(data: unknown): data is BillingUsageResponse {
  if (!data || typeof data !== "object") return false;
  const report = data as BillingUsageResponse;
  return (
    Boolean(report.usage) &&
    typeof report.usage.messagesCount === "number" &&
    Boolean(report.limits) &&
    typeof report.plan === "string"
  );
}

async function fetchPlanUsageReport(
  range: MetricsDateRange
): Promise<BillingUsageResponse> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  const data = await api.get<BillingUsageResponse>(
    `/billing/usage?${params.toString()}`
  );
  if (!isPlanUsageReport(data)) {
    throw new Error("Invalid plan usage report response");
  }
  return data;
}

export function usePlanUsageReport(
  range: MetricsDateRange | null,
  enabled = false
) {
  return useQuery({
    queryKey: ["reports", "plan-usage", range?.from ?? "", range?.to ?? ""],
    queryFn: () => fetchPlanUsageReport(range!),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}

export type { MonthlyUsage };
