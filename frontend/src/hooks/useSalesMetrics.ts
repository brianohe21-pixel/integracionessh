"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { SalesMetrics } from "@/types";

function isSalesMetrics(data: unknown): data is SalesMetrics {
  if (!data || typeof data !== "object") return false;
  const metrics = data as SalesMetrics;
  return (
    typeof metrics.totalRevenueInCents === "number" &&
    typeof metrics.paidCount === "number" &&
    Array.isArray(metrics.byBot) &&
    Array.isArray(metrics.topProducts) &&
    Array.isArray(metrics.topCustomersByCsat)
  );
}

async function fetchSalesMetrics(
  range: MetricsDateRange,
  botId?: string
): Promise<SalesMetrics> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<SalesMetrics>(`/metrics/sales?${params.toString()}`);
  if (!isSalesMetrics(data)) {
    throw new Error("Invalid sales metrics response");
  }
  return data;
}

export function useSalesMetrics(range: MetricsDateRange, botId?: string) {
  return useQuery({
    queryKey: ["metrics", "sales", range.from, range.to, botId ?? "all"],
    queryFn: () => fetchSalesMetrics(range, botId),
    refetchInterval: 60_000,
    retry: false,
  });
}
