"use client";

import { useQuery } from "@tanstack/react-query";
import { useTenantContextId } from "@/hooks/useActiveTenant";
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

export type SalesMetricsQueryOptions = {
  includeProducts?: boolean;
  includeCsat?: boolean;
};

async function fetchSalesMetrics(
  range: MetricsDateRange,
  botId?: string,
  options?: SalesMetricsQueryOptions
): Promise<SalesMetrics> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  if (options?.includeProducts === false) params.set("includeProducts", "false");
  if (options?.includeCsat === false) params.set("includeCsat", "false");
  const data = await api.get<SalesMetrics>(`/metrics/sales?${params.toString()}`);
  if (!isSalesMetrics(data)) {
    throw new Error("Invalid sales metrics response");
  }
  return data;
}

export function useSalesMetrics(
  range: MetricsDateRange,
  botId?: string,
  options?: SalesMetricsQueryOptions
) {
  const scope = useTenantContextId() ?? "home";
  const includeProducts = options?.includeProducts !== false;
  const includeCsat = options?.includeCsat !== false;
  return useQuery({
    queryKey: [
      "metrics",
      "sales",
      range.from,
      range.to,
      botId ?? "all",
      includeProducts,
      includeCsat,
      scope,
    ],
    queryFn: () => fetchSalesMetrics(range, botId, options),
    refetchInterval: 60_000,
    retry: false,
  });
}
